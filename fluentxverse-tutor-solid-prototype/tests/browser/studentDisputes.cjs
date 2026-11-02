const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  const directory='../output/screenshots/student-disputes';await fs.mkdir(directory,{recursive:true});
  try{
    for(const role of ['tutor','student','admin']) for(const width of [1440,375]) {
      const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
      page.setDefaultTimeout(10000);
      page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
      const user={userId:role+'-test',firstName:'Alex',lastName:'Example',role:role==='admin'?'superadmin':role,permissions:['all'],email:'synthetic@example.test'};
      const c={id:'case-test',origin:'student',tutorId:'tutor-test',bookingId:'lesson-test',startsAt:new Date(Date.now()-3600000).toISOString(),endsAt:new Date(Date.now()-2100000).toISOString(),createdAt:new Date().toISOString(),serverNow:new Date().toISOString(),deadline:new Date(Date.now()+86400000).toISOString(),state:role==='student'?'no_penalty':'awaiting_tutor',canReply:role==='tutor',canFollowup:role==='student',body:'Tutor joined late. Lesson on Saturday, Oct 31, 6:00 PM to 6:25 PM (Asia/Manila, UTC+08:00).',replies:[],decisionRevision:0};
      if(role==='student')c.decisionReason='Staff reviewed your lesson. Your ticket refund is completed.';
      await context.route(/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//,async route=>{
        const req=route.request(),p=new URL(req.url()).pathname;let json={success:true,user,data:[]};
        if(p.startsWith('/inbox/disputes')){
          if(req.method()==='POST'){
            if(p.endsWith('/reply')){const d=req.postDataJSON();assert.equal(d.text,'hi');assert.equal(d.reason,'other');c.canReply=false;c.state='awaiting_admin';c.replies.push({id:'reply',role:'tutor',body:d.text,createdAt:new Date().toISOString()});}
            if(p.endsWith('/followup'))assert.equal(req.postDataJSON().text,'Thank you, staff.');
            if(p.endsWith('/decision')){assert.equal(req.postDataJSON().decision,'no_penalty');c.decisionReason=req.postDataJSON().reason;c.state='no_penalty';}
            return route.fulfill({json:{success:true}});
          }
          json.data=[c];
        }else if(p.startsWith('/inbox/'))json.data={messages:[],total:0,stats:{unread:0},unreadCount:0};
        if(p==='/notifications')json.data={notifications:[],unreadCount:0};
        return route.fulfill({json});
      });
      const port={tutor:5197,student:5196,admin:5195}[role];await page.goto('http://127.0.0.1:'+port+'/inbox',{waitUntil:'networkidle'});
      const section=page.getByRole('region',{name:role==='admin'?'Student dispute review':'Private lesson cases'});
      try{await section.locator('summary').click();}catch(e){console.error(role,page.url(),(await page.locator('body').innerText()).slice(0,1000),errors);throw e;}
      if(role==='tutor'){
        await section.getByLabel('Explanation',{exact:true}).fill('hi');await section.getByLabel('Reason',{exact:true}).selectOption('other');await section.getByRole('button',{name:'Send reply',exact:true}).click();
        await section.getByText('hi',{exact:true}).waitFor();assert.equal(await section.getByRole('button',{name:'Send reply',exact:true}).count(),0);
      }else if(role==='student'){
        assert.equal(await section.getByLabel('Reason',{exact:true}).count(),0);await section.getByLabel('Reply privately to staff',{exact:true}).fill('Thank you, staff.');await section.getByRole('button',{name:'Send to staff',exact:true}).click();
      }else{
        await section.getByLabel('Outcome',{exact:true}).selectOption('no_penalty');await section.getByLabel('Decision explanation (sent to both parties)',{exact:true}).fill('Tutor earnings retained; student ticket refunded.');
        try{await section.getByRole('button',{name:'Apply decision',exact:true}).click();}catch(e){await page.screenshot({path:`${directory}/failure-admin-${width}.png`,fullPage:true});console.error(await section.innerText());throw e;}
        await page.getByRole('button',{name:'Resolved',exact:true}).click();await section.locator('summary').click();await section.getByText('Tutor earnings retained; student ticket refunded.',{exact:false}).waitFor();
      }
      assert.equal(errors.length,0,errors.join('\n'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.evaluate(()=>{scrollTo(0,0);document.querySelectorAll('*').forEach(e=>{if(e.scrollTop)e.scrollTop=0;});});await page.waitForTimeout(200);await page.screenshot({path:`${directory}/${role}-${width}.png`});await context.close();
    }
    console.log('Six desktop/mobile dispute inbox browser scenarios passed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
