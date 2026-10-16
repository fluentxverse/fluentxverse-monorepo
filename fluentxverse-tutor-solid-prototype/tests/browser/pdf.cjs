const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177';

function documentFixture() {
  const text = 'BT /F1 24 Tf 30 130 Td (Solid PDF compatibility) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1200, 375]) {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      const errors = [], workerRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.url().includes('pdf.worker')) workerRequests.push(request.url()); });
      await page.route('**/assets/materials/tutor_agreement.pdf', route => route.fulfill({ body: documentFixture(), contentType: 'application/pdf' }));
      await page.route('**/tutor/me', route => route.fulfill({ status: 401, json: { success: false } }));
      await page.goto(base + '/about');
      await page.evaluate(async () => {
        const { render } = await import('/node_modules/.vite/deps/solid-js_web.js');
        const { createComponent } = await import('/node_modules/.vite/deps/solid-js.js');
        const { default: Viewer } = await import('/tutor/Components/PdfViewer/PdfViewer.tsx');
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;inset:0;background:white;z-index:999999';
        document.body.appendChild(host);
        window.disposePdf = render(() => createComponent(Viewer, { userType: 'tutor' }), host);
      });
      await page.locator('.pdf-page-canvas').waitFor({ timeout: 30000 });
      await page.getByText('Solid PDF compatibility', { exact: true }).waitFor();
      const pixels = await page.locator('.pdf-page-canvas').evaluate(canvas => {
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let dark = 0, light = 0;
        for (let i = 0; i < data.length; i += 4) { if (data[i] < 100) dark++; if (data[i] > 240) light++; }
        return { dark, light, width: canvas.width, displayWidth: canvas.getBoundingClientRect().width };
      });
      assert.ok(pixels.dark > 100 && pixels.light > 1000, 'PDF canvas contains actual text and page pixels');
      assert.ok(pixels.width >= pixels.displayWidth * 2, 'PDF rendered above display resolution');
      assert.ok(workerRequests.some(url => url.includes('pdfjs-dist/build/pdf.worker.min.mjs')), 'Worker comes from the installed PDF package');
      await page.getByTitle('Enable highlighter', { exact: true }).click();
      await page.getByTitle('Clear all highlights', { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `test-results/pdf-${width}.png` });
      await page.evaluate(() => window.disposePdf());
      await page.close();
      console.log(`PASS PDF ${width}: matching worker, canvas pixels, text layer, resolution and toolbar`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
