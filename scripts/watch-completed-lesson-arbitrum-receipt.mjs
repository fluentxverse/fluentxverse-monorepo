import { readFileSync, writeFileSync } from 'node:fs';
import { ssh, quote } from './lib/cloud-ssh.mjs';

const directory = 'output/release/completed-lesson-arbitrum-20261030';
const journal = JSON.parse(readFileSync(directory + '/journal.json', 'utf8'));
if (journal.chainId !== 42161 || journal.domainId !== 10 || !/^[0-9a-f-]{36}$/.test(journal.engineSubmissionId))
  throw Error('A saved Arbitrum submission is required; this watcher cannot submit proofs');
const program = `
import assert from 'node:assert/strict';
import { finalizedDestinationReceipt, horizenReceiptReader } from './src/services/proof.services/horizenReceipt';
const id=${JSON.stringify(journal.engineSubmissionId)};
const request=async path=>{
  const response=await fetch(process.env.GMR_PAYOUT_ENGINE_API_BASE+path,{
    headers:{'X-GMR-Engine-Key':process.env.GMR_PAYOUT_ENGINE_API_KEY},
    signal:AbortSignal.timeout(95000),redirect:'error',
  });
  if(!response.ok)throw Error('Engine HTTP '+response.status);
  return response.json();
};
const {submission}=await request('/v1/zkverify/proofs/'+id);
assert.equal(submission.id,id);assert.equal(submission.zkVerifyNetwork,'zkVerify');
assert.equal(submission.domainId,10);assert.equal(submission.status,'finalized');
const native=JSON.parse(submission.transactionResult);
assert.equal(native.txHash,${JSON.stringify(journal.nativeResult.txHash)});
assert.equal(native.statement,${JSON.stringify(journal.nativeResult.statement)});
const {receipt}=await request('/v1/zkverify/proofs/'+id+'/receipt');
assert.equal(receipt.chainId,42161);assert.equal(receipt.domainId,10);
assert.equal(receipt.statement,native.statement);assert.equal(receipt.verifiedOnZkVerify,true);
let independentlyReadOnArbitrum=false;
if(finalizedDestinationReceipt(receipt,42161)){
  independentlyReadOnArbitrum=await horizenReceiptReader.verify({chainId:42161,domainId:10,
    bridge:'0xCb47A3C3B9Eb2E549a3F2EA4729De28CafbB2b69',rpcUrl:'https://arb1.arbitrum.io/rpc'},
    native.statement,receipt.receipt,{blockNumber:Number(receipt.arbitrumBlock),blockHash:receipt.arbitrumBlockHash});
  assert.equal(independentlyReadOnArbitrum,true);
}
console.log('RECEIPT '+JSON.stringify({checkedAt:new Date().toISOString(),engineSubmissionId:id,
  nativeTxHash:native.txHash,receipt,independentlyReadOnArbitrum}));
`;
const count = process.argv.includes('--once') ? 1 : 30;
for (let attempt = 0; attempt < count; attempt++) {
  const output = ssh('docker exec fluentxverse-server bun --no-env-file -e ' + quote(program), { timeout: 130000 });
  const line = output.split('\n').find(line => line.startsWith('RECEIPT '));
  if (!line) throw Error('Missing receipt result');
  const result = JSON.parse(line.slice(8));
  writeFileSync(directory + '/receipt-check.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ attempt, status: result.receipt.status, verifiedOnArbitrum: result.receipt.verifiedOnArbitrum,
    independentlyReadOnArbitrum: result.independentlyReadOnArbitrum, checkedAt: result.checkedAt }));
  if (result.independentlyReadOnArbitrum) break;
  if (attempt + 1 < count) await new Promise(resolve => setTimeout(resolve, 30000));
}
