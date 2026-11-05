import neo4j from 'neo4j-driver';
const p = await Bun.stdin.json(), d = neo4j.driver(p.URI, p.USER ? neo4j.auth.basic(p.USER, p.PASSWORD) : undefined), s = d.session();
try {
  const binding = p.config.projectId + ':' + p.config.epoch + ':' + p.config.contract + ':42161';
  const cursors = (await s.run('MATCH(c:DisputeSyncCursor {id:$binding}) RETURN c.cursor AS cursor,c.halt AS halt,c.until AS leaseUntil', { binding })).records.map(r => ({ cursor: Number(r.get('cursor')), halt: r.get('halt'), leaseUntil: r.get('leaseUntil') }));
  const records = (await s.run('MATCH(r:DisputeSyncRecord {binding:$binding}) RETURN r.json AS json ORDER BY r.sequence DESC LIMIT 200', { binding })).records.map(r => {
    const j = JSON.parse(r.get('json'));
    return { id: j.id, sequence: j.sequence, kind: j.event.kind, state: j.batchState || j.state,
      error: j.error, hash: j.hash || j.batchHash, batchLeader: j.batchLeader, batchMembers: j.batchMembers?.length || 0 };
  });
  const receipts = (await s.run('MATCH(r:DisputeSyncReceipt {binding:$binding}) RETURN r.id AS id,r.hash AS hash,r.blockHash AS blockHash', { binding })).records.map(r => r.toObject());
  const nonceLocks = (await s.run('MATCH(l:EngineWalletLock) WHERE l.transactionId CONTAINS $epoch RETURN l.transactionId AS id', { epoch: p.config.epoch })).records.map(r => r.get('id'));
  const activeRegistryNonceLocks = nonceLocks.length;
  if (cursors.some(c => c.halt) || records.some(r => r.error)) throw Error('Registry batch relay requires review');
  console.log(JSON.stringify({ batchSize: p.batchSize, cursors, records, receipts, activeRegistryNonceLocks, nonceLocks }));
} finally { await s.close(); await d.close(); }
