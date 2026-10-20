const { createRequire } = require('node:module');
const path = require('node:path');
const requireStudent = createRequire(path.resolve(__dirname,'../fluentxverse-student-solid-prototype/package.json'));
const { chromium, expect } = requireStudent('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const studentBase=process.env.STUDENT_TEST_URL||'http://127.0.0.1:5196';
const tutorBase=process.env.TUTOR_TEST_URL||'http://127.0.0.1:5197';
const adminBase=process.env.ADMIN_TEST_URL||'http://127.0.0.1:5198';
const out=path.resolve(__dirname,'../output/lesson-privacy');
const include=part=>!process.env.PRIVACY_BROWSER_PART||process.env.PRIVACY_BROWSER_PART===part;
const now=Date.now(),past=new Date(now-3600000).toISOString(),future=new Date(now+3600000).toISOString(),expiry=new Date(now+86400000).toISOString();
const report={id:'report',bookingId:'source',source:'student',reason:'connection',details:'Connection interruption',priority:'normal',status:'submitted',resolution:'',dueAt:future,createdAt:past,internalHistory:[],reviewHistory:[]};
const api=/^(https:\/\/api\.fluentxverse\.(com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//;
const envelope={algorithm:'Ed25519',publicKey:'fixture-key',keyId:'fixture-key-id',signature:'fixture-signature',payload:{schema:'fluentxverse.lesson-evidence.v1',id:'evidence',bookingCommitment:'opaque-commitment',issuedAt:past,thresholdMinutes:15,source:'platform_room_presence_records',claims:{attendance:{student:'threshold_met',tutor:'not_established'},overlap:'not_established'}}};
const evidence=()=>({id:'evidence',fields:['attendance','overlap'],createdAt:past,expiresAt:expiry,sharedWithSupport:false,envelope});

async function contextFor(browser,width,theme){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await context.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
  await context.routeWebSocket(/socket\.io/,socket=>socket.close());
  return context;
}
async function fit(page,selector){
  for(const section of await page.locator(selector).all()){
    assert.ok(await section.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Private panel content fits');
    const box=await section.boundingBox();assert.ok(box.x>=-1&&box.x+box.width<=page.viewportSize().width+1,'Private panel fits viewport');
  }
}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  try{
    for(const theme of include('student')?['light','dark']:[])for(const width of [1440,375,320]){
      const context=await contextFor(browser,width,theme);let records=[],fail=false;const writes=[];
      await context.route(api,async route=>{
        const req=route.request(),p=new URL(req.url()).pathname;
        assert.ok(!p.includes('/handover'),'No handover requests should be sent');
        const result=data=>route.fulfill({json:{success:true,data}});
        if(p==='/student/me')return route.fulfill({json:{success:true,user:{userId:'student',givenName:'Mika',role:'student'}}});
        if(p.startsWith('/lesson-privacy/')){
          if(req.method()==='GET'){
            if(fail)return route.fulfill({status:503,json:{success:false,error:'Unavailable'}});
            if(p.endsWith('/evidence'))return result({enabled:true,canCreate:true,canShare:true,records});
          }
          const body=req.postData()?req.postDataJSON():undefined;writes.push({p,body});
          if(req.method()==='POST'&&p.endsWith('/evidence')){records=[evidence()];return result(records[0]);}
          if(req.method()==='PUT'&&p.endsWith('/support')){records[0].sharedWithSupport=body.shared;return result(null);}
          return route.fulfill({status:400,json:{success:false}});
        }
        if(p==='/schedule/lesson/source')return result({bookingId:'source',tutorName:'Previous tutor',tutorId:'previous',startsAt:past,slotDate:past.slice(0,10),slotTime:'6:00 PM',durationMinutes:25,status:'completed',bookedAt:past});
        if(p.includes('/lesson-recap/'))return result({startsAt:past,materials:[],studentComment:'Lesson complete',englishLevelAssessment:3,studentAttendance:'present',workflow:{attendanceVerified:true,notesStatus:'submitted',endsAt:past,closed:true}});
        if(p==='/notifications')return result({notifications:[],unreadCount:0});
        if(p.endsWith('/issue-report'))return result({startsAt:past,lessonEndsAt:past,closesAt:future,serverNow:new Date().toISOString(),eligible:false,report});
        if(p.endsWith('/survey'))return result({eligible:false,reason:'expired',topics:[]});
        return result([]);
      });
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      if(process.env.PRIVACY_BROWSER_DEBUG){
        const cdp=await context.newCDPSession(page);await cdp.send('Debugger.enable');await cdp.send('Debugger.setPauseOnExceptions',{state:'all'});
        cdp.on('Debugger.paused',async event=>{console.error(event.data?.description||event.data?.value,event.callFrames?.slice(0,2).map(frame=>frame.url+':'+frame.location.lineNumber));await cdp.send('Debugger.resume');});
      }
      await page.goto(`${studentBase}/lesson/source`,{waitUntil:'domcontentloaded'});
      const panel=page.getByRole('region',{name:'Private dispute evidence'});
      await expect(panel).toBeVisible({timeout:30000}).catch(async error=>{
        console.error('Student fixture failure:',theme,width,errors,await page.locator('body').innerText());
        await page.screenshot({path:path.join(out,'removal-failure.png'),fullPage:true});throw error;
      });
      await expect(page.getByRole('region',{name:/learning handover/i})).toHaveCount(0);
      await expect(panel.getByRole('button',{name:'Create private snapshot'})).toBeDisabled();
      await panel.getByLabel('Attendance threshold for each participant').check();await panel.getByLabel('Shared time in the lesson room').check();
      await panel.getByRole('button',{name:'Create private snapshot'}).click();
      const consent=panel.getByLabel('Share this snapshot with support for my lesson issue');await expect(consent).not.toBeChecked();
      await consent.check();await expect(panel.getByText('Snapshot shared with authorized support.',{exact:true})).toBeVisible();
      await expect(consent).toBeChecked();await consent.uncheck();await expect(panel.getByText('Support access revoked.',{exact:true})).toBeVisible();
      const downloading=page.waitForEvent('download');await panel.getByRole('button',{name:'Download signed snapshot'}).click();
      const downloaded=await downloading;const downloadedJson=JSON.parse(await fs.readFile(await downloaded.path(),'utf8'));
      assert.deepEqual(downloadedJson,envelope);
      await fit(page,'.fxv-private-section');await panel.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(out,`student-${theme}-${width}.png`),fullPage:true});
      assert.deepEqual(errors,[]);await context.close();
      console.log(`PASS student ${theme} ${width}: handover absent; dispute consent, revoke, download and layout`);
    }
    for(const width of include('tutor')?[1440,320]:[]){
      const context=await contextFor(browser,width,'light');
      await context.route(api,route=>{
        const p=new URL(route.request().url()).pathname;assert.ok(!p.includes('/handover'),'No handover requests should be sent');const result=data=>route.fulfill({json:{success:true,data}});
        if(p==='/tutor/me')return route.fulfill({json:{success:true,user:{userId:'tutor',firstName:'Test',lastName:'Tutor',email:'tutor@example.test',role:'tutor'}}});
        if(p==='/proof/tutor-certification/me')return result({snapshot:{missingRequirements:[]}});
        if(p==='/schedule/week')return result({slots:[],weekStart:'2026-10-12',weekEnd:'2026-10-18'});
        if(p==='/schedule/tutor-lesson/target')return result({bookingId:'target',studentId:'student',slotDate:past.slice(0,10),slotTime:'6:00 PM',status:'completed',durationMinutes:25});
        if(p==='/tutor/student/student')return result({id:'student',givenName:'Test',familyName:'Student',hobbies:[]});
        if(p==='/lesson-privacy/tutor/target/evidence')return result({enabled:true,canCreate:true,canShare:false,records:[]});
        if(p==='/notifications')return result({notifications:[],unreadCount:0});
        if(p.endsWith('/trouble-report'))return result({startsAt:past,endsAt:past,serverNow:new Date().toISOString(),report:null,studentReport:null});
        if(p.includes('lesson-notes-edit-window'))return result({startsAt:past,endsAt:past,editableUntil:past,serverNow:new Date().toISOString(),canEdit:false});
        return result([]);
      });
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      if(process.env.PRIVACY_BROWSER_DEBUG){
        const cdp=await context.newCDPSession(page);await cdp.send('Debugger.enable');await cdp.send('Debugger.setPauseOnExceptions',{state:'all'});
        cdp.on('Debugger.paused',async event=>{console.error(event.data?.description||event.data?.value,event.callFrames?.slice(0,2).map(frame=>frame.url+':'+frame.location.lineNumber));await cdp.send('Debugger.resume');});
      }
      await page.goto(`${tutorBase}/lesson/target`,{waitUntil:'domcontentloaded'});
      const panel=page.getByRole('region',{name:'Private dispute evidence'});
      await expect(panel).toBeVisible({timeout:30000}).catch(async error=>{
        console.error('Tutor fixture failure:',width,errors,await page.locator('body').innerText());throw error;
      });
      await expect(page.getByRole('region',{name:/learning handover/i})).toHaveCount(0);
      await expect(panel.getByRole('button',{name:'Create private snapshot'})).toBeVisible();
      await expect(panel.getByRole('button',{name:'Create private snapshot'})).toBeDisabled();
      await fit(page,'.fxv-private-section');await panel.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(out,`tutor-${width}.png`),fullPage:true});
      assert.deepEqual(errors,[]);await context.close();console.log(`PASS tutor ${width}: handover absent, dispute evidence intact, layout`);
    }
    for(const width of include('support')?[1440,375]:[]){
      const context=await contextFor(browser,width,'light');let allowed=true;
      await context.route(api,route=>{
        const p=new URL(route.request().url()).pathname;assert.ok(!p.includes('/handover'),'No handover requests should be sent');const result=data=>route.fulfill({json:{success:true,data}});
        if(p==='/admin/me')return route.fulfill({json:{success:true,user:{userId:'admin',username:'Admin',role:'superadmin'}}});
        if(p==='/admin/operations/access')return result({role:'superadmin',permissions:['support']});
        if(p==='/admin/operations/reports')return result([report]);
        if(p==='/lesson-privacy/admin/reports/student/report/evidence')return result(allowed?[{...evidence(),sharedWithSupport:true}]:[]);
        return result([]);
      });
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`${adminBase}/lesson-operations?tab=issues`,{waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:'Private evidence',exact:true}).click();
      const panel=page.getByRole('region',{name:'Consented dispute evidence'});await expect(panel).toContainText('Snapshot ID: evidence');
      await panel.scrollIntoViewIfNeeded();await fit(page,'.private-dispute-evidence');
      await page.screenshot({path:path.join(out,`support-${width}.png`),fullPage:true});
      allowed=false;await page.getByRole('button',{name:'Refresh private evidence'}).click();
      await expect(panel).toContainText('No unexpired evidence is shared');await expect(panel).not.toContainText('Snapshot ID: evidence');
      assert.deepEqual(errors,[]);await context.close();console.log(`PASS support ${width}: explicit read, revocation refresh, layout`);
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
