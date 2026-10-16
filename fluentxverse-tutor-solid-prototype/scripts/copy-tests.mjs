import fs from 'node:fs';
import path from 'node:path';
const source = path.resolve(import.meta.dirname, '../../archive/preact/fluentxverse-tutor/tests');
const target = path.resolve(import.meta.dirname, '../tests');
fs.mkdirSync(path.join(target, 'browser'), { recursive: true });
for (const name of fs.readdirSync(source).filter(name => name.endsWith('.test.ts'))) {
  const text = fs.readFileSync(path.join(source, name), 'utf8').replaceAll('../src/', '../tutor/');
  fs.writeFileSync(path.join(target, name), text);
}
for (const name of fs.readdirSync(path.join(source, 'browser')).filter(name => name.endsWith('.cjs'))) {
  const text = fs.readFileSync(path.join(source, 'browser', name), 'utf8')
    .replaceAll("|| 'playwright'", "|| '@playwright/test'")
    .replaceAll('http://localhost:5181', 'http://127.0.0.1:5177')
    .replaceAll('http://localhost:5173', 'http://127.0.0.1:5177')
    .replaceAll('http://localhost:5174', 'http://127.0.0.1:5176')
    .replaceAll(':8765', ':(?:8765|8780|8782)')
    .replaceAll('../src/', '../tutor/');
  fs.writeFileSync(path.join(target, 'browser', name), text);
}
