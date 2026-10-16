const { spawnSync } = require('node:child_process');
const cases = process.argv.slice(2);
const suites = cases.length ? cases : require('./student-suites.json');
for (const suite of suites) {
  const result = spawnSync(process.execPath, [`tests/student/${suite}.cjs`], {
    env: { ...process.env, PLAYWRIGHT_MODULE: require.resolve('@playwright/test'), STUDENT_TEST_URL: process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176' },
    stdio: 'inherit', timeout: 600000,
  });
  if (result.status !== 0) { console.error(`Parity suite failed: ${suite}`, result.error?.message || ''); process.exit(1); }
}
