const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=10', '-t', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '/tmp/fluentxverse-intro-fixture.mp4']);
const bytes = fs.readFileSync('/tmp/fluentxverse-intro-fixture.mp4');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync('/tmp/fluentxverse-student-intro', { recursive: true });
  try {
    for (const width of [1440, 768, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [], mediaRequests = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        if (url.origin === base) return route.continue();
        if (path === '/lesson/files/user/video-fixture/video/intro.mp4/stream') {
          mediaRequests.push(request.headers().range);
          const range = request.headers().range?.match(/^bytes=(\d+)-(\d*)$/);
          const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
          return route.fulfill({ status: range ? 206 : 200, headers: { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), ...(range ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {}) }, body: bytes.subarray(start, end + 1) });
        }
        let json = { success: true, data: [] };
        if (path === '/student/me') json = { success: false };
        if (path === '/tutor/video-fixture') json.data = { userId: 'video-fixture', firstName: 'Video', lastName: 'Fixture', bio: 'Introduction', videoIntroUrl: 'http://fluentxverse-seaweed-filer:8888/user/video-fixture/video/intro.mp4', interests: [], education: [], languages: [], specializations: [] };
        if (path.includes('/schedule/')) json.data = { slots: [] };
        return route.fulfill({ json });
      });
      await page.goto(`${base}/tutor/video-fixture`, { waitUntil: 'networkidle' });
      const video = page.locator('.hero-video-section video');
      await expect(video).toBeVisible();
      await expect.poll(() => video.evaluate(v => v.readyState)).toBeGreaterThanOrEqual(2);
      assert.ok(await video.evaluate(v => v.duration > 0 && !v.error));
      await expect(page.getByText('Video unavailable. Please try again later.', { exact: true })).toHaveCount(0);
      await page.locator('.hero-video-section button[title="Play"]').click();
      await expect.poll(() => video.evaluate(v => v.currentTime)).toBeGreaterThan(.1);
      await page.locator('.hero-video-section button[title="Pause"]').click();
      await video.evaluate(v => { v.currentTime = 2; });
      await expect.poll(() => video.evaluate(v => v.seeking)).toBe(false);
      assert.ok(await video.evaluate(v => v.videoWidth > 0 && v.videoHeight > 0 && v.getVideoPlaybackQuality().totalVideoFrames > 0), 'Video frames were decoded');
      const bounds = await page.locator('.hero-video-section .fxv-video-player').boundingBox();
      assert.ok(bounds.width <= 561 && Math.abs(bounds.width / bounds.height - 16 / 9) < .02);
      assert.ok(mediaRequests.length > 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `/tmp/fluentxverse-student-intro/${width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: metadata, playback, seeking, no stale error and compact preview`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
