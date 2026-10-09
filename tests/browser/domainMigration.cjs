const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

// Serve built local assets under the actual target origins without depending on DNS.
// API identities are fixtures; this is not proof of production OAuth or DNS readiness.
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  try {
    for (const domain of ['fluentxverse.com', 'fluentxverse.xyz']) {
      for (const [app, port, path] of [['student',5174,'/browse-tutors'],['tutor',5173,'/'],['dashboard',5175,'/recordings']]) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const calls = [], socketUrls = [], errors = [];
        const origin = `https://${app}.${domain}`;
        await context.route(`https://${app}.${domain}/**`, async route => {
          const url = new URL(route.request().url());
          const response = await context.request.get(`http://127.0.0.1:${port}${url.pathname}${url.search}`);
          await route.fulfill({response});
        });
        await context.route(/^https:\/\/api\.fluentxverse\.(com|xyz)\//, route => {
          const url = new URL(route.request().url());
          calls.push(url);
          const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' };
          if (route.request().method() === 'OPTIONS') return route.fulfill({status:204,headers:{...headers,'Access-Control-Allow-Headers':'content-type,cache-control','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS'}});
          if (app !== 'dashboard' && url.pathname.endsWith('/me')) return route.fulfill({status:401,json:{success:false},headers});
          let json = {success:true,data:[]};
          if (url.pathname === '/admin/me') json = {success:true,user:{userId:'domain-test',username:'Domain Test',role:'admin'}};
          if (url.pathname.includes('/socket-token')) json = {success:true,token:'domain.fixture.token'};
          if (url.pathname === '/tutor/search') json.data = {tutors:[],total:0,page:1,limit:12,hasMore:false};
          return route.fulfill({json,headers});
        });
        await context.routeWebSocket(/^wss:\/\/ws\.fluentxverse\.(com|xyz)\//, ws => {
          socketUrls.push(ws.url());
          ws.onMessage(message => { if (String(message).startsWith('40')) ws.send('40{"sid":"domain-fixture"}'); });
          ws.send('0{"sid":"domain-fixture","upgrades":[],"pingInterval":25000,"pingTimeout":20000}');
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin + path, {waitUntil:'domcontentloaded'});
        await page.waitForFunction(() => document.body.innerText.trim().length > 20);
        await page.waitForTimeout(1500);
        assert(calls.some(url => url.pathname === `/${app === 'dashboard' ? 'admin' : app}/me`), `${app} restores its session from the expected API`);
        assert(calls.every(url => url.hostname === `api.${domain}`), `${app} must not use cross-site or stale build endpoints`);
        if (app === 'dashboard') {
          await page.getByRole('heading',{name:'QA Recordings',exact:true}).waitFor();
          assert(calls.some(url => url.pathname === '/admin/recordings/'));
          assert(socketUrls.length > 0, 'Administrator signaling uses the domain-matched WebSocket host');
          assert(socketUrls.every(url => new URL(url).hostname === `ws.${domain}`));
        }
        await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForTimeout(500);
        assert(calls.every(url => url.hostname === `api.${domain}`));
        assert.deepEqual(errors,[]);
        console.log(`PASS ${app}.${domain}: built assets, same-site API, session restoration request and refresh`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
