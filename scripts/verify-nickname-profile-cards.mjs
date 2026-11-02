import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const release = 'output/release/nickname-profile-cards-20261028';
const built = JSON.parse(readFileSync(`${release}/built.json`));
const checks = [
  ['tutor','fluentxverse-tutor-solid-prototype','tests/browser/tutorNickname.cjs','TUTOR_TEST_URL',5260],
  ['tutor','fluentxverse-tutor-solid-prototype','tests/browser/profileEducation.cjs','TUTOR_TEST_URL',5260],
  ['student','fluentxverse-student-solid-prototype','tests/profile-cards.cjs','STUDENT_TEST_URL',5261],
  ['student','fluentxverse-student-solid-prototype','tests/tutor-nickname.cjs','STUDENT_TEST_URL',5261],
  ['student','fluentxverse-student-solid-prototype','tests/intro-video.cjs','STUDENT_TEST_URL',5261],
  ['dashboard','fluentxverse-dashboard','tests/browser/tutorNickname.cjs','INTERVIEW_DASHBOARD_URL',5262],
  ['dashboard','fluentxverse-dashboard','tests/browser/profileReviewMedia.cjs','INTERVIEW_DASHBOARD_URL',5262],
];
for (const [app,directory,test,variable,port] of checks) execFileSync('node',[test],{
  cwd:`${release}/${app}/frontend/${directory}`,
  env:{...process.env,[variable]:`http://127.0.0.1:${port}`,PROFILE_CARDS_PORTRAIT:resolve('fluentxverse-tutor-solid-prototype/public/assets/img/banner/about-tutor-closeup-mobile-v2.webp')},stdio:'inherit',
});
writeFileSync(`${release}/verification.json`,JSON.stringify({passed:true,imageId:built.imageId,frontendHashes:built.apps,checks,verifiedAt:new Date().toISOString()},null,2));
