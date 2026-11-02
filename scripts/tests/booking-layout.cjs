const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const base=process.env.BOOKING_URL||'http://127.0.0.1:5199',out='output/screenshots/booking-layout';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{for(const width of [1440,390,320])for(const theme of ['light','dark'])for(const state of ['empty','available']){
 const ctx=await browser.newContext({viewport:{width,height:950}});await ctx.addInitScript(t=>{localStorage.setItem('fxv-theme',t);document.documentElement?.setAttribute('data-theme',t);},theme);
 let requests=0,booking=null;
 const date=new Date(Date.now()+86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});
 const slot={id:'test-slot',date,time:'9:00 AM',status:'open'};
 await ctx.route('**/*',async route=>{
 const r=route.request(),u=new URL(r.url());if(u.origin===base)return route.continue();
 const headers={'access-control-allow-origin':base,'access-control-allow-credentials':'true','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,cache-control,pragma'};
 if(r.method()==='OPTIONS')return route.fulfill({status:204,headers});
 const json={success:true,data:[]},p=u.pathname;
 if(p==='/tutor/me')json.user={userId:'test',firstName:'Test',email:'test@example.invalid',role:'tutor'};
 if(p==='/tutor/email-verification')json.data={verified:true};
 if(p==='/tutor-identity/status')json.data={enabled:true,record:{id:'identity',status:'accepted',bookingDeadline:new Date(Date.now()+84*3600000).toISOString()}};
 if(p==='/interview/available'){requests++;json.data=state==='available'?[slot]:[];}
 if(p==='/interview/my-booking')json.data=booking;
 if(p==='/interview/book'){assert.equal(r.postDataJSON().slotId,slot.id);booking={...slot,status:'booked'};json.data=booking;}
 if(p.includes('unread-count'))json.data={unreadCount:0};
 if(p.includes('notifications'))json.data={notifications:[],unreadCount:0};
 return route.fulfill({headers,json});});
 await ctx.routeWebSocket('**/*',ws=>ws.close());const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/interview');await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);
 await expect(page.getByRole('heading',{name:'Choose your interview time'})).toBeVisible();
 if(state==='empty'){await expect(page.getByRole('heading',{name:'No interview times available yet'})).toBeVisible();const n=requests;await page.getByRole('button',{name:'Check again',exact:true}).click();await expect.poll(()=>requests).toBeGreaterThan(n);}
 else{await expect(page.getByRole('button',{name:/Book interview on/})).toBeVisible();}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.screenshot({path:`${out}/${width}-${theme}-${state}.png`,fullPage:true});
 if(state==='available'){await page.getByRole('button',{name:/Book interview on/}).click();await expect(page.getByRole('heading',{name:'Confirm Interview Booking'})).toBeVisible();await page.getByRole('button',{name:'Confirm Booking',exact:true}).click();await expect(page.getByRole('heading',{name:'Your interview is booked'})).toBeVisible();}
 assert.deepEqual(errors,[]);await ctx.close();console.log(`PASS ${width}/${theme}/${state}`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
