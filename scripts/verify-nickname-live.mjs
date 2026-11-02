import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
const release = 'output/release/nickname-profile-cards-20261028';
const checks = [
  ['tutor','fluentxverse-tutor-solid-prototype','tests/browser/tutorNickname.cjs','TUTOR_TEST_URL','https://tutor.fluentxverse.com'],
  ['student','fluentxverse-student-solid-prototype','tests/profile-cards.cjs','STUDENT_TEST_URL','https://student.fluentxverse.com'],
  ['dashboard','fluentxverse-dashboard','tests/browser/tutorNickname.cjs','INTERVIEW_DASHBOARD_URL','https://dashboard.fluentxverse.com'],
];
for (const [app,directory,test,variable,url] of checks) execFileSync('node',[test],{
  cwd:`${release}/${app}/frontend/${directory}`,
  env:{...process.env,[variable]:url,PROFILE_CARDS_PORTRAIT:resolve('fluentxverse-tutor-solid-prototype/public/assets/img/banner/about-tutor-closeup-mobile-v2.webp')},stdio:'inherit',
});
const lookup = `import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';import{tutorPublicName}from'../shared/tutorPublicName';
await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();
try{const rows=await s.run("MATCH(u:User {profileStatus:'approved'}) RETURN u.id AS id,u.nickname AS nickname,u.firstName AS firstName LIMIT 20");
console.log(JSON.stringify(rows.records.map(r=>({id:r.get('id'),expected:tutorPublicName({nickname:r.get('nickname'),firstName:r.get('firstName')})}))));}
finally{await s.close();await closeDriver();}`;
const profiles = JSON.parse(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(lookup)}`).trim());
for (const profile of profiles) {
  const response = await fetch(`https://api.fluentxverse.com/tutor/${encodeURIComponent(profile.id)}`,{signal:AbortSignal.timeout(15000)});
  const data = (await response.json()).data;
  if (!response.ok || !data || data.displayName !== profile.expected || data.firstName !== profile.expected || data.lastName || data.middleName || data.email || data.pendingProfileChanges || data.profileItemStatuses) throw Error('Published public profile privacy contract failed');
}
const health = await fetch('https://api.fluentxverse.com/health',{signal:AbortSignal.timeout(15000)});
if (!health.ok) throw Error('Published API health check failed');
const deployment = JSON.parse(readFileSync(`${release}/deployment.json`));
writeFileSync(`${release}/live-smoke.json`,JSON.stringify({passed:true,checks,realPublicProfilesVerified:profiles.length,publicProfileReadsOnly:true,
  browserApiResponses:'Isolated fixtures; no customer records changed',deployed:deployment.deployed,imageId:deployment.imageId,verifiedAt:new Date().toISOString()},null,2));
console.log(`PASS: all three live apps; ${profiles.length} real public profiles respect nickname privacy; API healthy`);
