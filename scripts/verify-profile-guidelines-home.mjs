import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const release = 'output/release/profile-guidelines-home-20261028';
const built = JSON.parse(readFileSync(`${release}/built.json`));
const checks = ['profileGuidelines', 'interviewProgress', 'teachingDesk', 'introVideoLimit', 'profileMedia', 'profileEducation'];
for (const check of checks) execFileSync('node', [`tests/browser/${check}.cjs`], {
  cwd: `${release}/tutor/frontend/fluentxverse-tutor-solid-prototype`,
  env: { ...process.env, TUTOR_TEST_URL: 'http://127.0.0.1:5259' }, stdio: 'inherit',
});
writeFileSync(`${release}/verification.json`, JSON.stringify({
  passed: true, imageId: built.imageId, frontendHashes: built.apps,
  checks, browserWidths: [1440, 390, 375, 320], verifiedAt: new Date().toISOString(),
}, null, 2));
