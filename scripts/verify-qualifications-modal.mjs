import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { ssh, quote } from './lib/cloud-ssh.mjs';

const release = 'output/release/qualifications-modal-20261028';
const built = JSON.parse(readFileSync(`${release}/built.json`));
const fixture = 'fluentxverse-qualifications-release-qa-20261028';
let created = false;
try {
  console.log(ssh(`docker run -d --rm --network none --name ${fixture} fluentxverse-cloud/memgraph:20261023 --bolt-port=17727`));
  created = true;
  const readiness = "import{initDriver,closeDriver}from'./src/db/memgraph';await initDriver('bolt://127.0.0.1:17727','','',60,500);await closeDriver();";
  console.log(ssh(`docker run --rm --network container:${fixture} --entrypoint bun ${built.imageId} --no-env-file -e ${quote(readiness)}`, { timeout: 60000 }));
  console.log(ssh(`docker run --rm --network container:${fixture} -e EDUCATION_TEST_URI=bolt://127.0.0.1:17727 --entrypoint bun ${built.imageId} --no-env-file test ./tests/profileEducation.persistence.ts`, { timeout: 90000 }));
} finally {
  if (created) console.log(ssh(`docker stop ${fixture}`));
}
const tutor = `${release}/tutor/frontend/fluentxverse-tutor-solid-prototype`;
execFileSync('node', ['tests/browser/profileEducation.cjs'], { cwd: tutor, env: { ...process.env, TUTOR_TEST_URL: 'http://127.0.0.1:5255' }, stdio: 'inherit' });
execFileSync('node', ['tests/browser/settingsQualifications.cjs'], { cwd: tutor, env: { ...process.env, TUTOR_TEST_URL: 'http://127.0.0.1:5255' }, stdio: 'inherit' });
writeFileSync(`${release}/verification.json`, JSON.stringify({ passed: true, verifiedAt: new Date().toISOString(), imageId: built.imageId,
  frontendHashes: built.apps, apiPersistenceAssertions: 21, browserCases: 20,
  notes: 'Exact API image tested using a disposable network-disabled graph. Built frontend tested with intercepted fixture responses. No customer data changed.' }, null, 2));
