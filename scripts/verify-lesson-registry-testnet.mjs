import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { root } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';
const directory = 'output/release/lesson-registry-20261104';
const artifact = JSON.parse(readFileSync(directory + '/engine-source/internal/contracts/lesson_registry/artifact.json'));
const fixture = JSON.parse(readFileSync(directory + '/fixtures.json'));
const deployment = JSON.parse(readFileSync(directory + '/deployment.json'));
const previous = process.argv.includes('--finality-only') ? JSON.parse(readFileSync(directory + '/verification.json')) : null;
if (previous) {
  assert.equal(previous.contract.toLowerCase(), deployment.contract.toLowerCase());
  assert.equal(previous.negativeChecks.length, 6);
}
const journalCode = `import json
from pathlib import Path
j=json.loads(Path('/opt/fluentxverse/releases/lesson-registry-20261104/private/journal.json').read_text())
print(json.dumps({'contract':j['contract'],'reconciler':j['reconciler'],'hashes':[t['hash'] for t in j['transactions'].values()]}))`;
const journal = JSON.parse(root('python3 -c ' + quote(journalCode)));
assert.equal(journal.contract.toLowerCase(), deployment.contract.toLowerCase());
const code = String.raw`
import {createPublicClient,http,BaseError,ContractFunctionRevertedError} from 'viem';
const p=await Bun.stdin.json();
const c=createPublicClient({transport:http('https://sepolia-rollup.arbitrum.io/rpc',{timeout:15000,retryCount:0})});
if(await c.getChainId()!==421614)throw Error('Wrong chain');
const address=p.contract,abi=p.artifact.abi,read=(functionName,args=[])=>c.readContract({address,abi,functionName,args});
const expected=p.artifact.runtime.startsWith('0x')?p.artifact.runtime:'0x'+p.artifact.runtime;
if((await c.getCode({address})).toLowerCase()!==expected.toLowerCase())throw Error('Runtime differs');
const final=await c.getBlock({blockTag:'finalized'}),bookings=[];
for(const key of new Set(p.events.map(e=>e.caseKey))){
 const events=p.events.filter(e=>e.caseKey===key),changes=events.filter(e=>e.kind.startsWith('booking'));
 const last=changes.at(-1),committed=changes.filter(e=>e.kind!=='booking_cancel').at(-1);
 const b=await read('getBooking',[key]);
 if(Number(b.revision)!==last.bookingRevision||Number(b.status)!==(last.kind==='booking_cancel'?2:1)||b.commitment!==committed.commitment)throw Error('Booking state mismatch');
 const item={key,revision:String(b.revision),status:Number(b.status)};
 if(events.some(e=>e.kind==='open')){
  const d=await read('getCase',[key]);
  if(Number(d.stage)!==4||Number(d.outcome)!==2||d.refundApproved||Number(d.decisionCount)!==1)throw Error('Dispute outcome mismatch');
  item.dispute={stage:Number(d.stage),outcome:Number(d.outcome),refundApproved:d.refundApproved,decisions:String(d.decisionCount)};
 }
 bookings.push(item);
}
const receipts=[];
for(const hash of p.hashes){
 const r=await c.getTransactionReceipt({hash}),b=await c.getBlock({blockNumber:r.blockNumber});
 if(r.status!=='success'||b.hash!==r.blockHash)throw Error('Noncanonical or reverted receipt');
 receipts.push({hash,block:String(r.blockNumber),blockHash:r.blockHash,finalized:r.blockNumber<=final.number});
}
const operator=await read('engine'),errors=p.previousNegatives||[];
const expectedErrors=['BookingAlreadyExists','Unauthorized','PolicyNotApproved','StaleRevision','BookingNotFound','BookingHasDispute'];
for(let i=0;!p.previousNegatives&&i<p.rejections.length;i++){
 const r=p.rejections[i],e=r.event,op=r.operation||{functionName:e.kind==='open'?'openCase':'recordBooking',args:[e.caseKey,e.commitment,e.policyHash]};
 try{await c.simulateContract({address,abi,account:r.signer==='reconciler'?p.reconciler:operator,functionName:op.functionName,args:op.args});throw Error('Negative call unexpectedly accepted');}
 catch(error){const cause=error instanceof BaseError?error.walk(e=>e instanceof ContractFunctionRevertedError):null;if(!(cause instanceof ContractFunctionRevertedError)||cause.data?.errorName!==expectedErrors[i])throw error;errors.push(cause.data.errorName);}
}
console.log(JSON.stringify({chainId:421614,contract:address,runtimeMatches:true,paused:await read('paused'),nonResponseEnabled:await read('nonResponseEnabled'),
 bookings,receipts,negativeChecks:errors,finalizedHead:String(final.number),finalizedTimestamp:Number(final.timestamp),allFinalized:receipts.every(r=>r.finalized)}));
`;
const result = JSON.parse(root('docker exec -i budol-gmr-engine-1 bun --no-env-file -e ' + quote(code), {
  input: JSON.stringify({ artifact, ...journal, events: fixture.events, rejections: fixture.rejections, previousNegatives: previous?.negativeChecks }), timeout: 110000,
}));
assert.equal(result.bookings.length, 4);
assert.equal(result.negativeChecks.length, 6);
writeFileSync(directory + '/verification.json', JSON.stringify({ checkedAt: new Date().toISOString(),
  negativeChecksSource: previous ? 'cached pre-pause simulations' : 'live simulations', ...result }, null, 2));
console.log(JSON.stringify({ contract: result.contract, bookings: result.bookings.length, disputes: result.bookings.filter(b => b.dispute).length,
  transactions: result.receipts.length, negativeChecks: result.negativeChecks, finalized: result.receipts.filter(r => r.finalized).length,
  allFinalized: result.allFinalized, paused: result.paused }));
