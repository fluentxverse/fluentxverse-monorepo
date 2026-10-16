const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const base = process.env.INTERVIEW_AUDIT_URL || 'https://dashboard.fluentxverse.com';

async function main() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['camera', 'microphone'] });
  const events = [], uploads = [], errors = [], requests = [];
  const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,cache-control' };
  // Never send authenticated traffic, uploads, results or interview signals to production.
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    requests.push({ method: request.method(), origin: url.origin, path: url.pathname });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/admin/me') return route.fulfill({ headers, json: { success: true, user: { userId: 'audit-admin', email: 'fixture@example.test', role: 'admin' } } });
    if (url.pathname === '/admin/socket-token') return route.fulfill({ headers, json: { success: true, token: 'fixture-only' } });
    if (request.method() === 'POST' && url.pathname.includes('/interview/recording')) {
      const body = request.postDataBuffer()?.toString() || '';
      uploads.push({ origin: url.origin, path: url.pathname, fields: [...body.matchAll(/name="([^"]+)"/g)].map(match => match[1]) });
      return route.fulfill({ headers, status: 400, json: { success: false, error: 'Missing recording file' } });
    }
    if (url.hostname.startsWith('api.') || url.hostname.startsWith('ws.') || request.method() !== 'GET') return route.abort();
    if (url.origin !== base) return route.abort();
    return route.continue();
  });
  await context.routeWebSocket('**/socket.io/**', ws => {
    ws.send('0' + JSON.stringify({ sid: 'audit-fixture', upgrades: [], pingInterval: 25000, pingTimeout: 20000 }));
    ws.onMessage(message => {
      const value = String(message);
      if (value.startsWith('40')) ws.send('40' + JSON.stringify({ sid: 'audit-socket' }));
      if (value.startsWith('42')) events.push(JSON.parse(value.slice(2)));
      if (value === '2') ws.send('3');
    });
  });
  await context.addInitScript(() => {
    window.__auditStreams = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await original(constraints);
      window.__auditStreams.push(stream);
      return stream;
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${base}/interview-room/audit-fixture`, { waitUntil: 'domcontentloaded' });
    await page.locator('.btn-join').waitFor();
    console.log('Loaded published interview setup');
    await page.waitForFunction(() => !document.querySelector('.btn-join')?.disabled);
    const preview = await page.locator('.video-preview video').evaluate(video => ({ width: video.videoWidth, stream: Boolean(video.srcObject) }));
    assert(preview.stream);
    await page.locator('.btn-join').click();
    await page.getByTitle('Start recording', { exact: true }).waitFor();
    console.log('Entered fixture interview call');
    await page.waitForTimeout(500);
    const join = events.find(event => event[0] === 'interview:join');
    await page.locator('.btn-pass').click();
    await page.locator('.confirm-actions .btn-confirm.success').click();
    await page.getByText('Missing interview or tutor information', { exact: true }).waitFor();
    console.log('Reproduced missing tutor/interview result binding');
    await page.locator('.call-error button').click();
    await page.getByTitle('Start recording', { exact: true }).click();
    await page.getByTitle('Stop recording', { exact: true }).waitFor();
    await page.waitForTimeout(1200);
    await page.getByTitle('Stop recording', { exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.call-error')?.textContent.includes('Failed to upload recording'));
    await page.locator('.call-error button').click();
    await page.getByTitle('Mute', { exact: true }).click();
    const muted = await page.evaluate(() => window.__auditStreams.at(-1).getAudioTracks().every(track => !track.enabled));
    await page.getByTitle('Turn off camera', { exact: true }).click();
    const videoOff = await page.evaluate(() => window.__auditStreams.at(-1).getVideoTracks().every(track => !track.enabled));
    await page.getByTitle('End interview', { exact: true }).click();
    await page.locator('.confirm-modal').getByRole('button', { name: 'End Interview', exact: true }).click();
    const liveTracksAfterEnd = await page.evaluate(() => window.__auditStreams.flatMap(stream => stream.getTracks()).filter(track => track.readyState === 'live').length);
    mkdirSync(resolve(__dirname, 'screenshots'), { recursive: true });
    await page.screenshot({ path: resolve(__dirname, 'screenshots/interview-audit-desktop.png'), fullPage: true });
    console.log(JSON.stringify({ publishedBuild: base, preview, join, resultBlockedByMissingTutor: true, recordingUpload: uploads[0], muted, videoOff, liveTracksAfterEnd, browserErrors: errors }, null, 2));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: resolve(__dirname, 'screenshots/interview-audit-mobile.png'), fullPage: true });
    console.log(JSON.stringify({ mobilePageOverflows: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1) }));
  } catch (error) {
    console.log(JSON.stringify({ pageErrors: errors, requests, visibleText: (await page.locator('body').innerText()).slice(0, 1200) }));
    throw error;
  } finally { await context.close(); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
