import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudHost, quote, ssh } from './lib/cloud-ssh.mjs';

const checks = [];
async function probe(path, init, expected, edge = true) {
  const response = await fetch('https://api.fluentxverse.com' + path, { ...init, signal: AbortSignal.timeout(15000) });
  assert(expected.includes(response.status), `Unexpected status ${response.status} on ${path}`);
  if (edge) assert.equal(response.headers.get('x-fxv-edge-guard'), 'active', `No edge marker on ${path}`);
  if (init.headers?.origin) assert.equal(response.headers.get('access-control-allow-origin'), init.headers.origin);
  checks.push({ path, method: init.method || 'GET', status: response.status, edge });
  await response.arrayBuffer();
}
await probe('/tutor/intro-video', { method: 'POST', headers: { origin: 'https://tutor.fluentxverse.com' } }, [401]);
await probe('/tutor/profile-picture', { method: 'POST', headers: { origin: 'https://tutor.fluentxverse.com', cookie: 'tutorAuth=invalid' } }, [401]);
await probe('/exam/written/generate', { method: 'POST', headers: { origin: 'https://tutor.fluentxverse.com', 'content-type': 'application/json' }, body: '{}' }, [401]);
await probe('/student/auth/privy', { method: 'POST', headers: { origin: 'https://student.fluentxverse.com', 'content-type': 'application/json' }, body: '{}' }, [400, 401, 422]);
await probe('/tutor/login', { method: 'POST', headers: { origin: 'https://tutor.fluentxverse.com', 'content-type': 'application/json' }, body: '{}' }, [400, 422]);
await probe('/student/auth/privy', { method: 'POST', headers: { origin: 'https://student.fluentxverse.com', 'content-type': 'application/json' }, body: 'x'.repeat(65537) }, [413]);
await probe('/anonymous-reviews/public/status', { method: 'POST', headers: { origin: 'https://student.fluentxverse.com', 'content-type': 'application/json' }, body: '{}' }, [400, 422]);
await probe('/student/auth/privy', { method: 'OPTIONS', headers: { origin: 'https://student.fluentxverse.com', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } }, [200, 204]);
await probe('/health/detailed', {}, [200], false);

// Existing accounts are read only; short-lived signed tokens never leave the cloud process.
const privateProbe = `
import assert from 'node:assert/strict';
import neo4j from 'neo4j-driver';
import {signAuthToken} from './src/utils/jwt';
const driver=neo4j.driver(process.env.MEMGRAPH_URI,neo4j.auth.basic(process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD)),session=driver.session();
try{
 const records=(await session.run("MATCH (u:User) RETURN u LIMIT 1000")).records;
 const tutor=records.map(r=>r.get('u').properties).find(u=>u.id&&u.role!=='student'&&u.email);
 assert(tutor,'No tutor available for a read-only upload validation probe.');
 const token=await signAuthToken({userId:tutor.id,email:tutor.email,role:'tutor'},60);
 const form=new FormData();
 const r=await fetch('https://api.fluentxverse.com/tutor/profile-picture',{method:'POST',headers:{cookie:'tutorAuth='+token,origin:'https://tutor.fluentxverse.com'},body:form,signal:AbortSignal.timeout(15000)});
 const body=await r.json();
 assert.equal(r.status,200,'Legacy upload validation returns a JSON error envelope.');
 assert.equal(body.success,false);assert.equal(body.error,'Missing file','Authenticated multipart must reach missing-file validation, not a parser/auth error.');
 assert.equal(r.headers.get('x-fxv-edge-guard'),'active');
 const adminToken=await signAuthToken({userId:'request-defense-qa-nonexistent',email:'',role:'admin'},60);
 const mixed=await fetch('https://api.fluentxverse.com/tutor/profile-picture',{method:'POST',headers:{cookie:'adminAuth='+adminToken+'; tutorAuth='+token,origin:'https://tutor.fluentxverse.com'},body:new FormData(),signal:AbortSignal.timeout(15000)});
 assert.equal(mixed.status,200);assert.equal((await mixed.json()).error,'Missing file','An unrelated app session must not block a tutor upload.');
 const bypass=await fetch('http://127.0.0.1:8765/tutor/intro-video',{method:'POST',headers:{'cf-connecting-ip':'192.0.2.25',origin:'https://tutor.fluentxverse.com'},signal:AbortSignal.timeout(10000)});
 assert.equal(bypass.status,403,'Missing private edge marker must fail closed.');
 const wrong=await fetch('http://127.0.0.1:8765/tutor/intro-video',{method:'POST',headers:{'cf-connecting-ip':'192.0.2.25','x-fxv-edge-token':'incorrect',origin:'https://tutor.fluentxverse.com'},signal:AbortSignal.timeout(10000)});
 assert.equal(wrong.status,403);
 assert.equal(process.env.TRUST_CLOUDFLARE_TUNNEL,'true');assert.equal(process.env.REQUIRE_EDGE_GUARD,'true');
 console.log(JSON.stringify({authenticatedMultipartValidation:body.error,mixedAppCookiesVerified:true,missingEdgeMarker:bypass.status,wrongEdgeMarker:wrong.status,originEnforced:true}));
}finally{await session.close();await driver.close();}
`;
const origin = JSON.parse(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(privateProbe)}`));
assert.equal(ssh('systemctl is-active wg-quick@wgfxv').trim(), 'active');
assert.equal(ssh('systemctl is-enabled wg-quick@wgfxv').trim(), 'enabled');
const publicSSH = await new Promise(resolve => {
  const socket = connect({ host: cloudHost, port: 22 });
  socket.setTimeout(3000);
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('timeout', () => { socket.destroy(); resolve(false); });
  socket.once('error', () => resolve(false));
});
assert.equal(publicSSH, false, 'Public SSH must not connect.');
const report = { verifiedAt: new Date().toISOString(), checks, origin, privateSSH: true, publicIPv4SSHClosed: true, providerMitigationConfirmed: false, recoveryPeerLiveTested: false, liveMediaLessonTested: false };
const output = resolve(dirname(fileURLToPath(import.meta.url)), '../output/release/request-defense-20261024/verification.json');
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
