import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const dir='output/release/dispute-mainnet-20261103';
const read=(arg,key)=>{
 const output=execFileSync('node',['scripts/dispute-mainnet-operations.mjs',arg],{encoding:'utf8',timeout:90000,maxBuffer:2000000});
 const line=output.split('\n').find(line=>line.startsWith('{')&&line.includes('"'+key+'"'));
 if(!line)throw Error('Missing verification result');return JSON.parse(line);
};
let previous='';
for(let attempt=0;attempt<90;attempt++){
 const relay=read('--status','records');
 if(relay.cursors.some(c=>c.halt)||relay.records.some(r=>r.state==='review'||r.error))throw Error('Relay needs review; preserve journal');
 const phase=JSON.stringify(relay.records.map(r=>({sequence:r.sequence,state:r.state,hash:r.hash})));
 if(phase!==previous){console.log(JSON.stringify({at:new Date().toISOString(),relay}));previous=phase;}
 writeFileSync(dir+'/relay-progress.json',JSON.stringify({at:new Date().toISOString(),relay},null,2));
 if(relay.records.length>=2&&relay.records.every(r=>r.state==='finalized')){
  if(relay.activeProductionNonceLocks!==0||relay.receipts.length<2)throw Error('Final receipt journal or nonce release is incomplete');
  const chain=read('--verify-case','caseKey');
  if(chain.finalized.stage!==4||chain.finalized.outcome!==2||chain.finalized.refundApproved!==false||chain.finalized.decisionCount!=='1')throw Error('Final on-chain result differs from the synthetic support decision');
  const report={at:new Date().toISOString(),synthetic:true,relay,chain,application:JSON.parse(readFileSync(dir+'/smoke.json')),complete:true};
  writeFileSync(dir+'/mainnet-verification.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({complete:true,transactions:relay.receipts.map(r=>r.hash),chain}));process.exit(0);
 }
 await new Promise(resolve=>setTimeout(resolve,30000));
}
throw Error('Finality still pending; keep monitoring the existing journal');
