const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.STUDENT_TEST_URL || 'http://localhost:5182';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  await fs.mkdir('../output/screenshots/carousel-quality', { recursive: true });
  try {
    for (const [width, height, dpr] of [[1566, 900, 1], [1920, 1080, 2], [390, 844, 3], [320, 667, 2]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
      await context.route(/https:\/\/api\.fluentxverse\.(com|xyz)\//, route => route.fulfill({ status: 401, json: { success: false } }));
      await context.addInitScript(() => {
        window.__posterUploads = [];
        window.__heroFrames = [];
        const originalContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (...args) {
          const result = originalContext.apply(this, args);
          if (this.classList.contains('hero-stage__canvas') && args[0].startsWith('webgl')) window.__heroGl = result;
          return result;
        };
        for (const name of ['texImage2D', 'texSubImage2D']) {
          const original = WebGL2RenderingContext.prototype[name];
          WebGL2RenderingContext.prototype[name] = function (...args) {
            const source = args.find(value => value instanceof HTMLImageElement);
            if (source && source.src.includes('/assets/img/banner/')) window.__posterUploads.push({ src: source.src, width: source.naturalWidth, height: source.naturalHeight });
            return original.apply(this, args);
          };
        }
        const requestFrame = window.requestAnimationFrame.bind(window);
        let lastSample = 0;
        window.requestAnimationFrame = callback => requestFrame(time => {
          callback(time);
          const gl = window.__heroGl;
          if (!gl || time - lastSample < 1000) return;
          lastSample = time;
          const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
          gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let filled = 0, hash = 0, samples = 0;
          for (let i = 0; i < pixels.length; i += 404) {
            filled += pixels[i + 3] > 0 ? 1 : 0;
            hash += pixels[i] + pixels[i + 1] * 3 + pixels[i + 2] * 7;
            samples++;
          }
          window.__heroFrames.push({ filled: filled / samples, hash });
        });
      });
      const page = await context.newPage(), errors = [], shaderErrors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (/shader error|VALIDATE_STATUS|could not be compiled|error compiling/i.test(message.text())) shaderErrors.push(message.text()); });
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      await page.locator('.hero-stage__canvas').waitFor();
      try {
        await page.waitForFunction(() => new Set(window.__posterUploads.map(image => image.src)).size === 5, null, { timeout: 60000 });
      } catch (error) {
        console.error(await page.evaluate(() => ({ uploads: window.__posterUploads, frames: window.__heroFrames.slice(-3), scripts: [...document.scripts].map(script => script.src) })), errors, shaderErrors);
        await page.screenshot({ path: '../output/screenshots/carousel-quality/load-failure.png' });
        throw error;
      }
      await page.waitForFunction(() => window.__heroFrames.filter(frame => frame.filled > 0.1).length >= 3);
      const state = await page.evaluate(() => {
        const canvas = document.querySelector('.hero-stage__canvas');
        return { uploads: window.__posterUploads, frames: window.__heroFrames, width: canvas.width, height: canvas.height, cssWidth: parseFloat(canvas.style.width), cssHeight: parseFloat(canvas.style.height), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert(state.uploads.every(image => image.width > 1600), 'Original-resolution images reach the GPU');
      assert(state.width * state.height <= (state.cssWidth <= 768 ? 4_000_000 : 9_000_000), 'Rendering stays within the pixel budget');
      assert(state.width / state.cssWidth >= Math.min(dpr, 2) - 0.005, 'Existing device resolution is preserved');
      if (dpr !== 2) assert(state.width / state.cssWidth > Math.min(dpr, 2), 'Regular and 3x screens receive higher-resolution rendering');
      assert.equal(state.overflow, false);
      assert(new Set(state.frames.filter(frame => frame.filled > 0.1).map(frame => frame.hash)).size > 1, 'Carousel pixels change as it rotates');
      const canvas = page.locator('.hero-stage__canvas');
      await canvas.screenshot({ path: `../output/screenshots/carousel-quality/${width}-${dpr}x.png` });
      const first = await page.locator('.hero-stage__thumb.is-active').getAttribute('aria-label');
      await page.getByRole('button', { name: 'Next banner slide' }).click({ force: true });
      await page.waitForFunction(label => document.querySelector('.hero-stage__thumb.is-active')?.getAttribute('aria-label') !== label, first);
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4, { steps: 10 });
      await page.mouse.up();
      assert.deepEqual(errors, []);
      assert.deepEqual(shaderErrors, []);
      await context.close();
      console.log(`PASS carousel ${width} ${dpr}x: original texture uploads, bounded high-density rendering, nonblank moving pixels and controls`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
