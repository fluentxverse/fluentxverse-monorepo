import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { root } from './identity-mainnet-operations.mjs';
const release = 'output/release/lesson-registry-mainnet-20261104', api = join(release, 'api');
const remote = '/opt/fluentxverse/releases/lesson-registry-mainnet-20261104/api';
const { image: baseline } = JSON.parse(readFileSync(join(release, 'api-baseline.json')));
const image = 'fluentxverse-cloud/api:lesson-registry-mainnet-20261104';
const live = file => readFileSync(join(release, 'live-api', file), 'utf8');
const edit = (s, from, to) => { if (s.split(from).length !== 2) throw Error('Ambiguous API anchor: ' + from); return s.replace(from, to); };
const write = (file, value) => { mkdirSync(dirname(join(api, file)), { recursive: true }); writeFileSync(join(api, file), value); };
for (const file of ['src/services/disputeChain/outbox.ts', 'src/services/studentDispute.service.ts',
  'src/services/admin.services/operations.service.ts', 'src/services/schedule.services/attendanceRecovery.service.ts',
  'src/services/lessonRegistry/outbox.ts', 'src/routes/lessonRegistry.route.ts',
  'tests/lessonRegistry.test.ts', 'tests/lessonRegistry.persistence.ts', 'tests/lessonRegistry.concurrency.ts',
  'tests/lessonRegistry.production.smoke.ts']) {
  mkdirSync(dirname(join(api, file)), { recursive: true }); cpSync(join('fluentxverse-server', file), join(api, file));
}
let index = live('src/index.ts');
index = "import { lessonRegistryRoute } from './routes/lessonRegistry.route';\n" + index;
index = edit(index, '.use(disputeChainRoute)', '.use(disputeChainRoute)\n  .use(lessonRegistryRoute)');
write('src/index.ts', index);
let schedule = live('src/services/schedule.services/schedule.service.ts');
schedule = "import { captureBooking, ensureRegistryOutbox } from '../lessonRegistry/outbox';\n" + schedule;
schedule = edit(schedule, 'async bookSlot(input: BookSlotInput): Promise<Booking> {', 'async bookSlot(input: BookSlotInput): Promise<Booking> {\n    await ensureRegistryOutbox();');
schedule = edit(schedule, "if (!result.records.length) throw new Error('Checkout reservation expired before booking could finish');\n        return result;", "if (!result.records.length) throw new Error('Checkout reservation expired before booking could finish');\n        await captureBooking(tx, bookingId, 'booking');\n        return result;");
const current = readFileSync('fluentxverse-server/src/services/schedule.services/schedule.service.ts', 'utf8');
const start = '      const cancelled = await ', end = '      if (!cancelled.records.length) {';
if (schedule.split(start).length !== 2 || schedule.split(end).length !== 2) throw Error('Student cancellation anchor changed');
schedule = schedule.slice(0, schedule.indexOf(start)) + current.slice(current.indexOf(start), current.indexOf(end)) + schedule.slice(schedule.indexOf(end));
write('src/services/schedule.services/schedule.service.ts', schedule);
for (const file of ['disputeChainPolicy.json', 'lessonRegistryDeployment.json']) {
  mkdirSync(join(api, 'shared'), { recursive: true }); cpSync('shared/' + file, join(api, 'shared', file));
}
write('Dockerfile', `FROM ${baseline}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\nCOPY --chown=appuser:appgroup shared/ /shared/\n`);
if (root("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim() !== baseline) throw Error('Live API baseline changed');
root(`install -d ${remote} && tar -xzf - -C ${remote}`, { input: execFileSync('tar', ['-czf', '-', '-C', api, '.']) });
console.log(root(`docker build --network none -t ${image} ${remote}`));
console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/registry-api-check.js`));
console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/lessonRegistry.test.ts tests/studentDispute.test.ts tests/attendanceRecovery.test.ts tests/attendanceWindow.test.ts tests/trialLaunch.test.ts`));
writeFileSync(join(release, 'api-prepared.json'), JSON.stringify({ baseline, image, changes: 'Registry outbox and feed only; other live behavior preserved' }));
