const { chromium } = require('/home/paulanthonyarriola/.local/lib/python3.14/site-packages/playwright/driver/package');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('http://localhost:5174/ice-smoke', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>ICE smoke test</title>' }));
    await page.goto('http://localhost:5174/ice-smoke');
    const result = await page.evaluate(async () => {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });
      const candidates = [];
      const errors = [];
      pc.onicecandidate = event => { if (event.candidate) candidates.push({ type: event.candidate.type, protocol: event.candidate.protocol }); };
      pc.onicecandidateerror = event => errors.push({ code: event.errorCode, url: event.url });
      pc.createDataChannel('stun-check');
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 12000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') { clearTimeout(timer); resolve(); }
        };
      });
      pc.close();
      return { candidates, errors };
    });
    console.log(JSON.stringify(result));
    assert.ok(result.candidates.some(candidate => candidate.type === 'srflx'), 'Cloudflare STUN did not produce a server-reflexive candidate');
    console.log('PASS: Cloudflare STUN works in Chrome on this network');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
