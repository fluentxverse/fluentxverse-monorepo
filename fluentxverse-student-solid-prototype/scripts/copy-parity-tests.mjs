import fs from 'node:fs';
import path from 'node:path';
const original = path.resolve(import.meta.dirname, '../../archive/preact/fluentxverse-student/tests/browser');
const target = path.resolve(import.meta.dirname, '../tests/student');
fs.mkdirSync(target, { recursive: true });
const suites = JSON.parse(fs.readFileSync(new URL('../tests/student-suites.json', import.meta.url), 'utf8'));
for (const file of suites.map(name => name + '.cjs')) {
  const source = fs.readFileSync(path.join(original, file), 'utf8')
    .replaceAll("process.env.PLAYWRIGHT_MODULE || 'playwright'", "process.env.PLAYWRIGHT_MODULE || '@playwright/test'")
    .replaceAll("'http://localhost:5174'", "'http://127.0.0.1:5176'")
    .replaceAll(':8765', ':(?:8765|8780)')
    .replaceAll(':8767', ':(?:8767|8781)');
  fs.writeFileSync(path.join(target, file), source);
}
console.log('Copied student parity checks. API responses stay mocked; no real bookings or transactions.');
