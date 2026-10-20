import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { releaseCases } from './release-cases.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const appDir = app => path.join(root, `fluentxverse-${app}-solid-prototype`);
const args = process.argv.slice(2);
const deploy = args.find(arg => arg.startsWith('--deploy='))?.split('=')[1];
if (deploy && !['student', 'tutor', 'all'].includes(deploy)) throw new Error('Deploy must be student, tutor, or all');
const require = createRequire(path.join(appDir('student'), 'package.json'));
const { chromium } = require('@playwright/test');
let browserPath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/google-chrome';
try { await access(browserPath); } catch { browserPath = chromium.executablePath(); }
const env = { ...process.env, VITE_ENABLE_TICKETING: 'true', PLAYWRIGHT_EXECUTABLE_PATH: browserPath, TEST_WIDTHS: '320,375,1440' };
const previews = [], results = [];
const artifact = path.join(root, 'output/release/result.json');

async function run(label, command, argv, cwd = root, overrides = {}) {
    console.log(`\n[release] ${label}`);
    const started = Date.now();
    const code = await new Promise((resolve, reject) => {
        const child = spawn(command, argv, { cwd, env: { ...env, ...overrides }, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve(signal ? 1 : code));
    });
    results.push({ label, passed: code === 0, durationMs: Date.now() - started });
    if (code !== 0) throw new Error(`Release blocked: ${label} failed (${code})`);
}
async function unusedPort() {
    const server = createServer();
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}
async function startPreview(app) {
    const port = await unusedPort(), url = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
        cwd: appDir(app), env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    previews.push(child);
    let output = '';
    let startupError;
    child.once('error', error => { startupError = error; });
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    for (let attempt = 0; attempt < 100; attempt++) {
        if (startupError) throw startupError;
        if (child.exitCode !== null || child.signalCode !== null) throw new Error(`${app} preview exited: ${output}`);
        try { if ((await fetch(url)).ok) return url; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`${app} preview did not start: ${output}`);
}
async function stopPreviews() {
    await Promise.all(previews.map(child => new Promise(resolve => {
        if (child.exitCode !== null || child.signalCode !== null) return resolve();
        child.once('exit', resolve); child.kill('SIGTERM');
        const timer = setTimeout(() => child.kill('SIGKILL'), 3000); timer.unref();
    })));
}
process.once('SIGINT', () => { void stopPreviews().finally(() => process.exit(130)); });
process.once('SIGTERM', () => { void stopPreviews().finally(() => process.exit(143)); });
await mkdir(path.join(root, 'output/screenshots'), { recursive: true });
await mkdir(path.dirname(artifact), { recursive: true });
try {
    for (const app of ['student', 'tutor']) {
        await run(`${app} unit tests`, 'npm', ['test'], appDir(app));
        if (!args.includes('--skip-build') || deploy) await run(`${app} production build`, 'npm', ['run', 'build'], appDir(app));
    }
    await run('Startup bundle budgets', process.execPath, ['scripts/check-app-budgets.mjs']);
    env.STUDENT_TEST_URL = await startPreview('student');
    env.TUTOR_TEST_URL = await startPreview('tutor');
    for (const [app, file, options] of releaseCases) await run(`${app}: ${path.basename(file)}`, process.execPath, [file], appDir(app), options);
    await stopPreviews();
    if (deploy) for (const app of (deploy === 'all' ? ['student', 'tutor'] : [deploy]))
        await run(`${app} Cloudflare deployment`, 'bunx', ['--bun', 'wrangler@4.151.1', 'deploy', '--config', 'wrangler.jsonc'], appDir(app));
    console.log('\nRelease checks passed.');
} catch (error) {
    console.error(error.message); process.exitCode = 1;
} finally {
    await stopPreviews();
    await writeFile(artifact, JSON.stringify({ passed: !process.exitCode, createdAt: new Date().toISOString(), results }, null, 2));
}
