import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
const root=process.cwd(), release=join(root,'output/release/admin-booking-settings-20261028');
const built=JSON.parse(readFileSync(join(release,'built.json')));
const image='fluentxverse-cloud/api:admin-booking-settings-20261028';
if(ssh(`docker image inspect ${image} --format '{{.Id}}'`).trim()!==built.imageId)throw Error('API image changed');
const network='fxv-booking-settings-qa-20261028';
let created=false;
try{
  ssh(`docker network create --internal ${network}`);created=true;
  ssh(`docker run --rm -d --name booking-settings-postgres --network ${network} -e POSTGRES_DB=booking_settings_qa -e POSTGRES_USER=booking_settings_qa -e POSTGRES_PASSWORD=qa_only fluentxverse-cloud/postgres:20261023`);
  ssh(`for i in $(seq 1 30); do if docker exec booking-settings-postgres pg_isready -U booking_settings_qa -d booking_settings_qa >/dev/null 2>&1; then exit 0; fi; sleep 1; done; exit 1`,{timeout:45000});
  console.log(ssh(`docker run --rm --network ${network} -e NODE_ENV=test -e DATABASE_URL=postgresql://booking_settings_qa:qa_only@booking-settings-postgres:5432/booking_settings_qa --entrypoint bun ${image} --no-env-file tests/bookingSettings.persistence.ts`,{timeout:90000}));
  writeFileSync(join(release,'api-verification.json'),JSON.stringify({passed:true,imageId:built.imageId,isolatedPostgres:true,verifiedAt:new Date().toISOString()},null,2));
}finally{
  if(created){try{ssh('docker rm -f -v booking-settings-postgres');}finally{ssh(`docker network rm ${network}`);}}
}
const cwd=join(release,'dashboard/frontend/fluentxverse-dashboard');
const preview=spawn('bunx',['--bun','vite','preview','--host','127.0.0.1','--port','5272','--strictPort'],{cwd,detached:true,stdio:'ignore'});
try{
  let ready=false;
  for(let i=0;i<60;i++){
    try{if((await fetch('http://127.0.0.1:5272/settings')).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready)throw Error('Scoped dashboard preview did not start');
  console.log(execFileSync('node',['tests/browser/bookingSettings.cjs'],{cwd,env:{...process.env,DASHBOARD_TEST_URL:'http://127.0.0.1:5272'},encoding:'utf8',maxBuffer:4e6}));
  writeFileSync(join(release,'verification.json'),JSON.stringify({passed:true,imageId:built.imageId,frontendHashes:built.apps,verifiedAt:new Date().toISOString()},null,2));
}finally{try{process.kill(-preview.pid,'SIGTERM');}catch{}}
