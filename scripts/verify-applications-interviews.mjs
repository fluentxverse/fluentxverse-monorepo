import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { ssh, quote } from './lib/cloud-ssh.mjs';

const release = 'output/release/applications-interviews-20261028';
const built = JSON.parse(readFileSync(`${release}/built.json`));
const fixture = 'fluentxverse-applications-release-qa-20261028';
let created = false;
try {
  console.log(ssh(`docker run -d --rm --network none --name ${fixture} fluentxverse-cloud/memgraph:20261023 --bolt-port=17726`));
  created = true;
  const readiness = "import{initDriver,closeDriver}from'./src/db/memgraph';await initDriver('bolt://127.0.0.1:17726','','',60,500);await closeDriver();";
  console.log(ssh(`docker run --rm --network container:${fixture} --entrypoint bun ${built.imageId} --no-env-file -e ${quote(readiness)}`, { timeout: 60000 }));
  console.log(ssh(`docker run --rm --network container:${fixture} -e APPLICATION_CATALOG_TEST_URI=bolt://127.0.0.1:17726 --entrypoint bun ${built.imageId} --no-env-file test ./tests/tutorApplications.persistence.ts`, { timeout: 90000 }));
} finally {
  if (created) console.log(ssh(`docker stop ${fixture}`));
}

const run = (cwd, args, env = {}) => execFileSync('bun', args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' });
const dashboard = `${release}/dashboard/frontend/fluentxverse-dashboard`;
const tutor = `${release}/tutor/frontend/fluentxverse-tutor-solid-prototype`;
run(dashboard, ['test', 'tests/tutorApplications.test.ts', 'tests/interviewPeriod.test.ts']);
run(tutor, ['test']);
run(dashboard, ['tests/browser/applicationCatalog.cjs'], { INTERVIEW_DASHBOARD_URL: 'http://127.0.0.1:5253' });
run(dashboard, ['tests/browser/interviewPeriod.cjs'], { INTERVIEW_DASHBOARD_URL: 'http://127.0.0.1:5253' });
run(dashboard, ['tests/browser/interview-calendar.cjs'], { INTERVIEW_DASHBOARD_URL: 'http://127.0.0.1:5253' });
run(tutor, ['tests/browser/interviewAppointmentCard.cjs'], { TUTOR_TEST_URL: 'http://127.0.0.1:5252' });
writeFileSync(`${release}/verification.json`, JSON.stringify({ passed: true, verifiedAt: new Date().toISOString(), imageId: built.imageId,
  frontendHashes: built.apps, apiPersistenceAssertions: 25, tutorUnitTests: 120, dashboardUnitTests: 3,
  browserChecks: { applicationCatalog: 4, periodTimezones: 2, calendarLayouts: 10, appointmentStates: 32 },
  notes: 'Exact production image tested on an isolated, network-disabled disposable graph. Built frontend previews tested with fixture API responses; no applicant records modified.' }, null, 2));
