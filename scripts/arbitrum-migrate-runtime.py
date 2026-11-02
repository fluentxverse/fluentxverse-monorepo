import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request

STAGE = '/opt/fluentxverse/releases/arbitrum-migration-20261029'
COMPOSE = '/opt/fluentxverse/releases/20261023/compose.private.json'
ROOT = '2a798002-7ed3-4e98-853e-62306479b9da'
RPC = 'https://arb1.arbitrum.io/rpc'
BRIDGE = '0xCb47A3C3B9Eb2E549a3F2EA4729De28CafbB2b69'


def save(path, value):
    fd = os.open(path + '.next', os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(value, stream, indent=2)
    os.replace(path + '.next', path)


def inspect(name):
    return json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]


def environment(container):
    return dict(item.split('=', 1) for item in container['Config']['Env'])


def rpc(method, params):
    body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}).encode()
    request = urllib.request.Request(RPC, data=body, headers={'Content-Type': 'application/json', 'User-Agent': 'FluentXVerse-Engine/1.0'})
    with urllib.request.urlopen(request, timeout=20) as response:
        result = json.load(response)
    if 'error' in result or 'result' not in result:
        raise RuntimeError('Arbitrum RPC rejected ' + method)
    return result['result']


ENGINE = inspect('budol-gmr-engine-1')
ENV = environment(ENGINE)


def graph(action, prior=None):
    # Run in a disposable API process while the long-running writers are stopped.
    script = r"""
import neo4j from 'neo4j-driver';import{createHash}from'node:crypto';
const i=JSON.parse(await Bun.stdin.text()),d=neo4j.driver(i.uri,neo4j.auth.basic(i.user,i.password)),s=d.session();
try{const value=await s.executeWrite(async tx=>{
const records=(await tx.run('MATCH(a:EngineApp) WHERE a.id=$root OR a.parentProjectId=$root OPTIONAL MATCH(owner:GMRAccount)-[:OWNS_ENGINE_APP]->(a) RETURN a.id AS id,a.allowedChains AS chains,a.proofReceiptChainId AS destination,a.proofDestinationRevision AS revision,owner.id AS owner',{root:i.root})).records.map(r=>r.toObject());
const nodes=[...new Map(records.map(r=>[r.id,r])).values()].map(r=>({...r,chains:r.chains.map(Number),destination:r.destination===null?null:Number(r.destination),revision:r.revision===null?null:Number(r.revision)}));
if(nodes.length!==6||!nodes.some(n=>n.id===i.root&&n.owner))throw Error('Expected six owned FluentXVerse projects');
const ids=nodes.map(n=>n.id);
const proofs=(await tx.run('MATCH(p:ZKProofSubmission) WHERE p.appId IN $ids RETURN properties(p) AS p ORDER BY p.id',{ids})).records.map(r=>r.get('p'));
if(proofs.some(p=>{if(['finalized','failed'].includes(p.status))return false;try{return !['finalized','failed'].includes(JSON.parse(p.transactionResult).status);}catch{return true;}}))throw Error('In-flight native proof requires reconciliation');
const proofDigest=createHash('sha256').update(JSON.stringify(proofs)).digest('hex');
if(i.action==='apply'){
for(const n of nodes)if(!n.chains.every(c=>[8453,42161].includes(c))||(n.destination!==null&&![8453,42161].includes(n.destination)))throw Error('Unexpected project chain state');
const current=nodes.find(n=>n.id===i.root);
await tx.run('MATCH(a:EngineApp) WHERE a.id IN $ids SET a.allowedChains=[42161],a.updatedAt=$now',{ids,now:i.now});
await tx.run('MATCH(a:EngineApp{id:$root}) SET a.proofReceiptChainId=42161,a.proofDestinationRevision=$revision,a.updatedAt=$now CREATE(:EngineProofDestinationAudit{id:$audit,projectId:$root,actor:$owner,previousChainId:$previous,chainId:42161,createdAt:$now})',{root:i.root,revision:neo4j.int((current.revision||0)+1),owner:current.owner,previous:neo4j.int(current.destination||8453),audit:'fluentxverse-arbitrum-20261029',now:i.now});
}else if(i.action==='rollback'){
for(const n of i.prior.nodes)await tx.run('MATCH(a:EngineApp{id:$id}) SET a.allowedChains=$chains,a.proofReceiptChainId=$destination,a.proofDestinationRevision=$revision',{id:n.id,chains:n.chains.map(neo4j.int),destination:n.destination===null?null:neo4j.int(n.destination),revision:n.revision===null?null:neo4j.int(n.revision)});
await tx.run("MATCH(a:EngineProofDestinationAudit{id:'fluentxverse-arbitrum-20261029'}) SET a.rolledBackAt=$now",{now:i.now});
}
return{nodes,proofDigest,proofCount:proofs.length};
});console.log('MIGRATION_RESULT '+JSON.stringify(value));}finally{await s.close();await d.close();}
"""
    payload = {'uri': ENV['GMR_ENGINE_MEMGRAPH_URI'], 'user': ENV.get('GMR_ENGINE_MEMGRAPH_USER', ''),
               'password': ENV.get('GMR_ENGINE_MEMGRAPH_PASSWORD', ''), 'root': ROOT,
               'action': action, 'prior': prior, 'now': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    command = ['docker', 'compose', '-f', COMPOSE, 'run', '--rm', '--no-deps', '-T', '--entrypoint', 'bun', 'api', '--no-env-file', '-e', script]
    result = subprocess.run(command, input=json.dumps(payload), text=True, capture_output=True, timeout=90)
    if result.returncode:
        raise RuntimeError('Graph migration failed: ' + result.stderr[-1500:])
    return json.loads(next(line[len('MIGRATION_RESULT '):] for line in result.stdout.splitlines() if line.startswith('MIGRATION_RESULT ')))


mode = sys.argv[1]
backup_file = STAGE + '/rollback.private.json'
if mode == 'preflight':
    if int(rpc('eth_chainId', []), 16) != 42161:
        raise RuntimeError('Arbitrum identity mismatch')
    block = rpc('eth_getBlockByNumber', ['finalized', False])
    if rpc('eth_getCode', [BRIDGE.lower(), block['number']]) in ['0x', '0x0']:
        raise RuntimeError('Official Arbitrum receipt bridge missing')
    print('Arbitrum chain identity and finalized bridge preflight passed.')
elif mode == 'apply':
    if os.path.exists(backup_file):
        raise RuntimeError('Migration backup already exists; inspect before retry')
    if int(rpc('eth_chainId', []), 16) != 42161:
        raise RuntimeError('Arbitrum identity mismatch')
    block = rpc('eth_getBlockByNumber', ['finalized', False])
    if rpc('eth_getCode', [BRIDGE.lower(), block['number']]) in ['0x', '0x0']:
        raise RuntimeError('Official Arbitrum receipt bridge missing')
    config = json.load(open(COMPOSE))
    mount = next(m for m in ENGINE['Mounts'] if m['Destination'] == '/app/config')
    paths = [mount['Source'] + ENV[key][len('/app/config'):] for key in ['GMR_ENGINE_ZKVERIFY_POLICY_PATH', 'GMR_ENGINE_SCREENING_PROVER_PATH', 'GMR_ENGINE_PAYOUT_PROVER_PATH']]
    prior = graph('inventory')
    backup = {'compose': config, 'files': {path: json.load(open(path)) for path in paths}, 'graph': prior}
    save(backup_file, backup)
    ids = {n['id'] for n in prior['nodes']}
    for path in paths:
        data = json.loads(json.dumps(backup['files'][path]))
        for id, policy in data.items():
            if id not in ids:
                continue
            if 'config' in policy:
                cfg = policy['config']
                if cfg['chainId'] != 8453 or cfg['domainId'] != 2:
                    raise RuntimeError('Unexpected prover baseline')
                cfg.update(chainId=42161, domainId=10, bridge=BRIDGE)
            else:
                if policy['domainId'] != 2:
                    raise RuntimeError('Unexpected policy baseline')
                policy['domainId'] = 10
                if 'chainId' in policy.get('bindings', {}):
                    policy['bindings']['chainId'] = '42161'
        save(path, data)
    engine_env = config['services']['gmr-engine']['environment']
    mappings = json.loads(engine_env.get('GMR_ENGINE_CHAIN_RPC_URLS', '{}'))
    mappings['42161'] = RPC
    engine_env['GMR_ENGINE_CHAIN_RPC_URLS'] = json.dumps(mappings)
    engine_env['GMR_ENGINE_ARBITRUM_MAINNET_RPC_URL'] = RPC
    api_env = config['services']['api']['environment']
    for prefix in ['SCREENING', 'ANONYMOUS_REVIEWS', 'LESSON_PASSES', 'PAYOUT']:
        api_env[prefix + '_CHAIN_ID'] = '42161'
    for key in ['SCREENING_ZKVERIFY_DOMAIN_ID', 'PAYOUT_ZKVERIFY_DOMAIN_ID', 'ANONYMOUS_REVIEWS_DOMAIN_ID', 'LESSON_PASSES_DOMAIN_ID', 'ZKVERIFY_DOMAIN_ID']:
        api_env[key] = '10'
    for prefix in ['SCREENING', 'ANONYMOUS_REVIEWS', 'LESSON_PASSES']:
        api_env[prefix + '_RPC_URL'] = RPC
    config['services']['api']['image'] = 'fluentxverse-cloud/api:arbitrum-migration-20261029'
    config['services']['gmr-engine']['image'] = 'fluentxverse-cloud/gmr-engine:arbitrum-migration-20261029'
    graph('apply')
    save(COMPOSE, config)
    print(json.dumps({'migratedProjects': len(ids), 'chainId': 42161, 'domainId': 10, 'historicalProofCount': prior['proofCount'], 'historicalProofsRewritten': False}))
elif mode == 'rollback':
    if not os.path.exists(backup_file):
        print('No mutation backup exists; settings unchanged.')
        sys.exit(0)
    backup = json.load(open(backup_file))
    graph('rollback', backup['graph'])
    for path, data in backup['files'].items():
        save(path, data)
    save(COMPOSE, backup['compose'])
    print('Previous settings restored.')
elif mode == 'verify':
    prior = json.load(open(backup_file))['graph']
    current = graph('inventory')
    if current['proofDigest'] != prior['proofDigest']:
        raise RuntimeError('Historical proof records changed during migration')
    if not all(n['chains'] == [42161] for n in current['nodes']):
        raise RuntimeError('Module chain migration incomplete')
    root = next(n for n in current['nodes'] if n['id'] == ROOT)
    if root['destination'] != 42161:
        raise RuntimeError('Project receipt destination mismatch')
    print(json.dumps({'verified': True, 'projects': len(current['nodes']), 'chainId': 42161, 'domainId': 10, 'historicalProofsPreserved': current['proofCount']}))
else:
    raise RuntimeError('Use apply, rollback, or verify')
