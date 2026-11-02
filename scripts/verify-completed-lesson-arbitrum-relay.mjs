import { readFileSync, writeFileSync } from 'node:fs';
import { ssh, quote } from './lib/cloud-ssh.mjs';

const directory = 'output/release/completed-lesson-arbitrum-20261030';
const journal = JSON.parse(readFileSync(directory + '/journal.json', 'utf8'));
const checkpoint = JSON.parse(readFileSync(directory + '/receipt-check.json', 'utf8'));
if (!checkpoint.receipt.receipt || checkpoint.receipt.domainId !== 10 || journal.chainId !== 42161)
  throw Error('Published Arbitrum aggregation receipt required');
const program = `
import assert from 'node:assert/strict';
import { createPublicClient, http, parseAbi, parseAbiItem } from 'viem';
const client=createPublicClient({transport:http('https://arb1.arbitrum.io/rpc',{timeout:15000,retryCount:0})});
assert.equal(await client.getChainId(),42161);
const bridge='0xcb47a3c3b9eb2e549a3f2ea4729de28cafbb2b69';
const receipt=${JSON.stringify(checkpoint.receipt.receipt)};
const statement=${JSON.stringify(journal.nativeResult.statement)};
const abi=parseAbi(['function proofsAggregations(uint256,uint256) view returns(bytes32)',
  'function verifyProofAggregation(uint256,uint256,bytes32,bytes32[],uint256,uint256) view returns(bool)']);
const latest=await client.getBlock({blockTag:'latest'}),finalized=await client.getBlock({blockTag:'finalized'});
const root=await client.readContract({address:bridge,abi,functionName:'proofsAggregations',args:[10n,BigInt(receipt.aggregationId)],blockNumber:latest.number});
assert.notEqual(BigInt(root),0n);
assert.equal(await client.readContract({address:bridge,abi,functionName:'verifyProofAggregation',
  args:[10n,BigInt(receipt.aggregationId),statement,receipt.merklePath,BigInt(receipt.leafCount),BigInt(receipt.index)],blockNumber:latest.number}),true);
const logs=await client.getLogs({address:bridge,
  event:parseAbiItem('event AggregationPosted(uint256 indexed domainId,uint256 indexed aggregationId,bytes32 indexed proofsAggregation)'),
  args:{domainId:10n,aggregationId:BigInt(receipt.aggregationId),proofsAggregation:root},
  fromBlock:519626428n,toBlock:519626428n});
assert.equal(logs.length,1);
const log=logs[0],transaction=await client.getTransactionReceipt({hash:log.transactionHash});
assert.equal(transaction.status,'success');assert.equal(transaction.blockHash,log.blockHash);
assert.equal((await client.getBlock({blockNumber:log.blockNumber})).hash,log.blockHash);
assert.equal((await client.getBlock({blockNumber:latest.number})).hash,latest.hash);
console.log('RELAY '+JSON.stringify({checkedAt:new Date().toISOString(),chainId:42161,domainId:10,
  aggregationId:receipt.aggregationId,root,statement,transactionHash:log.transactionHash,
  blockNumber:String(log.blockNumber),blockHash:log.blockHash,receiptPathVerifiedAtLatest:true,
  finalizedBlock:String(finalized.number),relayBlockFinalized:finalized.number>=log.blockNumber}));
`;
const output=ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(program),{timeout:90000});
const line=output.split('\n').find(line=>line.startsWith('RELAY '));
if(!line)throw Error('Missing relay verification result');
const result=JSON.parse(line.slice(6));
writeFileSync(directory+'/arbitrum-relay.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
