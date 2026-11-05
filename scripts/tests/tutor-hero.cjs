const{chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5290';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});fs.mkdirSync('/tmp/fxv-tutor-hero',{recursive:true});
 try{for(const[width,height]of[[1920,1080],[1440,900],[1024,768],[768,1024],[390,844],[320,740]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),errors=[],requests=[];
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:401,json:{success:false}}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.addInitScript(()=>{window.__lcp=[];new PerformanceObserver(list=>window.__lcp.push(...list.getEntries().map(e=>({time:e.startTime,size:e.size,url:e.url})))).observe({type:'largest-contentful-paint',buffered:true});});
  await page.goto(base+'/',{waitUntil:'networkidle'});
  const hero=page.getByRole('region',{name:/Teach English/});await expect(hero).toBeVisible();
  await expect(hero.locator('h1')).toHaveText('Teach English Online on Your Terms');
  await expect(hero.locator('.hero-image')).toBeVisible();assert(await hero.locator('.hero-image').evaluate(i=>i.complete&&i.naturalWidth>0));
  await expect(hero.getByRole('link',{name:'Apply Now'})).toHaveAttribute('href','/register');
  await expect(hero.getByRole('link',{name:'Learn More'})).toHaveAttribute('href','/about');
  await expect(hero.locator('.feature-badge')).toHaveCount(3);
  await expect(hero.locator('.hero-language-art')).toHaveCount(0);
  const badges=await hero.locator('.feature-badge').evaluateAll(items=>items.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,width:r.width,overflow:el.scrollWidth>el.clientWidth};}));
  assert(badges.every(b=>Math.abs(b.y-badges[0].y)<1&&!b.overflow),'Badges must share one horizontal row: '+JSON.stringify(badges));
  assert(badges[1].x>=badges[0].right&&badges[2].x>=badges[1].right,'Badges cannot overlap');
  assert(Math.abs(badges[0].width-badges[2].width)<2,'Badges should be evenly distributed');
  for(const img of await hero.locator('.feature-illustration img').all())await expect.poll(()=>img.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  await expect(hero.locator('.hero-image-wrapper')).toBeVisible();
  assert.equal(await hero.locator('.tutor-recruitment-inner').count(),0,'No redesigned hero');
  assert(!requests.some(url=>/about-tutor-closeup|\/LoginModal-[^/]+\.js/.test(url)),'Replacement photo and login module must not load initially');
  const image=await hero.locator('.hero-image').evaluate(i=>i.currentSrc);assert(image.endsWith('/banner_man.webp'),'Keep the original tutor photo');
  const geometry=await hero.evaluate(el=>{const r=el.getBoundingClientRect(),h=el.querySelector('h1').getBoundingClientRect();return{top:r.top,bottom:r.bottom,heading:{left:h.left,right:h.right,top:h.top,bottom:h.bottom}};});
  assert(geometry.heading.left>=0&&geometry.heading.right<=width&&geometry.heading.top>=geometry.top);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const perf=await page.evaluate(()=>({lcp:window.__lcp.at(-1),resources:performance.getEntriesByType('resource').length,jsBytes:performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.js')).reduce((n,r)=>n+r.encodedBodySize,0)}));
  await page.screenshot({path:'/tmp/fxv-tutor-hero/'+width+'.png'});
  if(width<992){await page.getByRole('button',{name:'Open mobile menu',exact:true}).click();await page.getByRole('dialog',{name:'Navigation',exact:true}).getByRole('button',{name:'Login',exact:true}).click();}
  else await page.getByRole('button',{name:'Login',exact:true}).click();
  await expect(page.getByRole('dialog').last()).toBeVisible();assert(requests.some(url=>/\/LoginModal-[^/]+\.js/.test(url)));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({width,passed:true,perf}));await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
