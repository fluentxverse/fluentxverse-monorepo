import { mkdirSync, writeFileSync } from 'node:fs';
import { ssh, quote } from './lib/cloud-ssh.mjs';
const code=String.raw`
import {createPublicClient,http} from 'viem';
const j=await Bun.file('/app/deployments/dispute-pilot-20261102/private/journal.json').json();
const map=JSON.parse(process.env.GMR_ENGINE_CHAIN_RPC_URLS||'{}');
const client=createPublicClient({transport:http(process.env.GMR_ENGINE_ARBITRUM_SEPOLIA_RPC_URL||map['421614']||'https://sepolia-rollup.arbitrum.io/rpc',{timeout:15000,retryCount:0})});
if(await client.getChainId()!==421614)throw Error('Wrong pilot chain');
const finalized=await client.getBlock({blockTag:'finalized'});
if(finalized.number===null)throw Error('Finalized head unavailable');
const entries=Object.entries(j.transactions),transactions=[];
for(let i=0;i<entries.length;i+=4){
 const rows=await Promise.all(entries.slice(i,i+4).map(async([operation,t])=>{
  if(!t.complete)throw Error('Unconfirmed pilot operation');
  const receipt=await client.getTransactionReceipt({hash:t.hash});
  const block=await client.getBlock({blockNumber:receipt.blockNumber});
  if(receipt.status!=='success'||receipt.blockHash!==block.hash||receipt.blockHash!==t.blockHash)throw Error('Pilot receipt changed');
  return {operation,hash:t.hash,blockNumber:receipt.blockNumber.toString(),finalized:receipt.blockNumber<=finalized.number};
 }));transactions.push(...rows);
}
console.log(JSON.stringify({chainId:421614,contract:j.contract,confirmedOperations:transactions.length,finalizedOperations:transactions.filter(t=>t.finalized).length,
 finalizedHead:finalized.number.toString(),finalizedHeadTime:new Date(Number(finalized.timestamp)*1000).toISOString(),transactions}));
`;
const watch=process.argv.includes('--wait');
const deadline=Date.now()+30*60*1000;
do {
  const result=JSON.parse(ssh('docker exec budol-gmr-engine-1 bun --no-env-file -e '+quote(code),{timeout:90000}));
  const report={checkedAt:new Date().toISOString(),...result};
  mkdirSync('output/verification/dispute-chain-20261102',{recursive:true});
  writeFileSync('output/verification/dispute-chain-20261102/finality.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({checkedAt:report.checkedAt,confirmed:result.confirmedOperations,finalized:result.finalizedOperations,finalizedHeadTime:result.finalizedHeadTime}));
  if(result.confirmedOperations===result.finalizedOperations)break;
  if(!watch||Date.now()>=deadline){process.exitCode=2;break;}
  await new Promise(resolve=>setTimeout(resolve,60000));
}while(true);
