import { parse } from 'acorn';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createPublicClient, http, parseAbi } from 'viem';
import pin from '../shared/tutorRewardsDeployment.json';
import aero from '../shared/tutorRewardsAero.json';
import { initialRewardSymbols } from '../shared/tutorRewards';
import { aeroFactoryAbi, aeroQuoterAbi } from '../fluentxverse-server/src/services/tutorRewards/aero';
import { alchemyRewardPrices } from '../fluentxverse-server/src/services/tutorRewards/alchemy';

// Read-only discovery. Never turn frontend token symbols into an automatically approved financial allowlist.
const registryUrl = 'https://app.aero.xyz/assets/useTokenPrices-ChAyJ-Vn.js';
const source = await (await fetch(registryUrl)).text();
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const pools: any[] = [];
const value = (n: any) => n?.type === 'Literal' ? n.value : n?.type === 'TemplateLiteral' && !n.expressions.length ? n.quasis[0].value.cooked : undefined;
function visit(node: any) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'ObjectExpression') {
    const fields = Object.fromEntries(node.properties.filter((p: any) => p.type === 'Property' && !p.computed).map((p: any) => [p.key.name ?? p.key.value, value(p.value)]));
    if (fields.chainId === pin.chainId && fields.token0 && fields.token1 && Number(fields.type) > 0) pools.push(fields);
  }
  for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(visit); else if (child && typeof child === 'object') visit(child);
}
visit(ast);
const c = createPublicClient({ transport: http(pin.rpcUrl, { timeout: 15000, retryCount: 0 }) });
if (await c.getChainId() !== pin.chainId) throw Error('Wrong Robinhood chain');
const factory = await c.readContract({ address: aero.router as `0x${string}`, abi: parseAbi(['function factory() view returns(address)']), functionName: 'factory' });
if (factory.toLowerCase() !== aero.factory) throw Error('Aero router factory mismatch');
const tokens = [...new Set<string>(pools.flatMap(p => [p.token0.toLowerCase(), p.token1.toLowerCase()]))];
const candidates: any[] = [];
for (const token of tokens) {
  const abi = parseAbi(['function symbol() view returns(string)', 'function decimals() view returns(uint8)']);
  let symbol: string;
  try { symbol = await c.readContract({ address: token as `0x${string}`, abi, functionName: 'symbol' }); } catch { continue; }
  if (!(initialRewardSymbols as readonly string[]).includes(symbol)) continue;
  const decimals = await c.readContract({ address: token as `0x${string}`, abi, functionName: 'decimals' });
  const routes: any[] = [];
  for (const p of pools.filter(p => [p.token0.toLowerCase(), p.token1.toLowerCase()].includes(token) && [p.token0.toLowerCase(), p.token1.toLowerCase()].includes(pin.settlementToken))) {
    const pool = await c.readContract({ address: aero.factory as `0x${string}`, abi: aeroFactoryAbi, functionName: 'getPool', args: [token, pin.settlementToken, Number(p.type)] });
    if (String(pool).toLowerCase() !== p.address.toLowerCase()) throw Error('Aero frontend pool does not match canonical factory');
    const liquidity = await c.readContract({ address: pool, abi: parseAbi(['function liquidity() view returns(uint128)']), functionName: 'liquidity' });
    let quote: string | null = null;
    try { const { result } = await c.simulateContract({ address: aero.quoter as `0x${string}`, abi: aeroQuoterAbi, functionName: 'quoteExactInput', args: [[pool], pin.settlementToken, 12_000_000n] }); quote = String(result[0]); } catch {}
    routes.push({ pool: String(pool).toLowerCase(), tickSpacing: Number(p.type), liquidity: String(liquidity), quoteFor12Usd: quote });
  }
  let pricing: any = { configured: false };
  if (alchemyRewardPrices.configured()) {
    try { const [price] = await alchemyRewardPrices.get([token]); pricing = { covered: true, value: price!.value, observedAt: price!.observedAt }; }
    catch { pricing = { covered: false }; }
  }
  candidates.push({ symbol, token, decimals, issuerEligibilityReviewed: false, approved: false, routes, pricing });
}
const report = { at: new Date().toISOString(), chainId: pin.chainId, registryUrl,
  registrySHA256: createHash('sha256').update(source).digest('hex'), factory: aero.factory, router: aero.router, quoter: aero.quoter,
  stateChanged: false, candidates, missingSymbols: initialRewardSymbols.filter(s => !candidates.some(c => c.symbol === s)) };
mkdirSync('output/verification/tutor-rewards-aero', { recursive: true });
writeFileSync('output/verification/tutor-rewards-aero/discovery.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
