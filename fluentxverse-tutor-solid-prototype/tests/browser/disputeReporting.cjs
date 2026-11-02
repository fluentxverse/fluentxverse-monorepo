const {chromium}=require('@playwright/test');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});try{
  for(const ongoing of [true,false])for(const width of [1440,375]){
    const c=await b.newContext({viewport:{width,height:900}}),p=await c.newPage();let sent=0;
    await c.route(/\/schedule\/lesson\/synthetic-report\/issue-report/,async route=>{
      if(route.request().method()==='POST'){const d=route.request().postDataJSON();assert.equal(d.duration,undefined);assert.equal(d.reason,'tutor');assert.equal(d.tutorIssue,'late_join');sent++;return route.fulfill({json:{success:true,data:{id:'sent',reason:d.reason,details:d.details,createdAt:new Date().toISOString()}}});}
      return route.fulfill({json:{success:true,data:{eligible:true,report:null,startsAt:new Date(Date.now()-180000).toISOString(),lessonEndsAt:new Date(Date.now()+(ongoing?1200000:-1000)).toISOString(),closesAt:new Date(Date.now()+86400000).toISOString(),serverNow:new Date().toISOString(),availableAt:new Date(Date.now()-60000).toISOString()}}});
    });
    await p.goto('http://127.0.0.1:5196/tests/dispute-report.html');await p.getByRole('button',{name:'Report issue',exact:true}).click();
    assert.equal(await p.getByRole('button',{name:'10 minutes or less',exact:true}).count(),0);
    if(ongoing){assert.equal(await p.locator('input[type=radio]').count(),3);assert.equal(await p.getByText('Tutor behaved inappropriately or disrespectfully',{exact:true}).count(),0);}
    else await p.getByLabel('Tutor-related issue',{exact:true}).check();
    await p.getByLabel('Tutor joined late',{exact:true}).check();await p.getByRole('button',{name:'Send report',exact:true}).click();await p.getByRole('button',{name:'Issue reported',exact:true}).waitFor();assert.equal(sent,1);assert(await p.getByRole('button',{name:'Issue reported',exact:true}).isDisabled());await c.close();
  }console.log('Four desktop/mobile ongoing/post-lesson reporting scenarios passed');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
