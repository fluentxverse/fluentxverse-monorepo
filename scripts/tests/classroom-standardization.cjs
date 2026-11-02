const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const bases={tutor:process.env.TUTOR_TEST_URL||'http://127.0.0.1:5271',student:process.env.STUDENT_TEST_URL||'http://127.0.0.1:5272'};
const id='classroom-parity-fixture';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 fs.mkdirSync('/tmp/fluentxverse-classroom-parity',{recursive:true});
 try{for(const width of [1440,1024,390,320])for(const theme of ['light','dark']){
  const styles={};
  for(const role of ['student','tutor']){
   const base=bases[role],other=role==='tutor'?'student':'tutor';
   const context=await browser.newContext({viewport:{width,height:950},permissions:['camera','microphone'],reducedMotion:'reduce',colorScheme:theme});
   await context.addInitScript(theme=>localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2})),theme);
   let status='waiting',consent=null,consentWrites=[],socket,readCount=0,historyReads=0;
   const startsAt=new Date(Date.now()-300000).toISOString(),endsAt=new Date(Date.now()+1200000).toISOString();
   const request={lessonId:'',courseId:'conversational-skills',title:'Everyday conversation',lessonNumber:1,goal:'Speak with confidence',studentPreferences:{cameraOn:true,proficiency:'Level 3',errorCorrection:'during_feedback',otherRequests:'Please speak clearly and allow extra thinking time. '.repeat(8)}};
   const user={userId:`${role}-parity`,id:`${role}-parity`,role,firstName:'Test',givenName:'Test',email:'test@example.invalid'};
   await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780|8782))\//,route=>{
    const path=new URL(route.request().url()).pathname;
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204});
    const json={success:true,user,data:[],lessons:[],notifications:[]};
    if(path.endsWith('/socket-token'))return route.fulfill({json:{success:true,token:'fixture-token'}});
    if(path==='/proof/tutor-certification/me')json.data={snapshot:{writtenPassed:true,speakingPassed:true,profileApproved:true,interviewPassed:true,missingRequirements:[]}};
    if(path==='/student/profile')json.data={...user,currentProficiency:'Level 3'};
    if(path.includes('/lesson-request'))json.data=request;
    if(path===`/schedule/lesson-material-request/${id}`)json.data={canRequestMaterial:false,materialRequest:null};
    if(path===`/schedule/lesson-recap/${id}`)json.data={startsAt,canRequestMaterial:false,materialRequest:null,materials:[],studentComment:'',englishLevelAssessment:null,previousLessonId:null,nextLessonId:null};
    if(path==='/notifications')json.data={notifications:[],unreadCount:0};
    if(path.startsWith('/tutor/classroom-lesson-notes/'))json.data={materials:[],studentComment:'',tutorMemo:'',englishLevelAssessment:null,updatedAt:null};
    if(path===`/schedule/lesson/${id}`)json.data={bookingId:id,tutorId:'tutor-parity',tutorName:'Alex',startsAt,durationMinutes:25,status:'confirmed',bookedAt:startsAt};
    if(path===`/schedule/tutor-lesson/${id}`)json.data={bookingId:id,studentId:'student-parity',sessionId:id,slotDate:startsAt.slice(0,10),slotTime:'8:00 PM',status:'confirmed',durationMinutes:25};
    if(path==='/tutor/student/student-parity')json.data={id:'student-parity',givenName:'Test',familyName:'Student',hobbies:[],joinDate:'2026-01-01'};
    if(path.includes('/issue-report')||path.includes('/trouble-report'))json.data={eligible:false,reason:'not_ended',report:null,startsAt,endsAt,closesAt:endsAt,serverNow:new Date().toISOString()};
    if(path.endsWith('/survey'))json.data={eligible:false,reason:'not_ended',readyAt:null,survey:null,topics:[]};
    return route.fulfill({json});
   });
   await context.routeWebSocket('**/socket.io/**',ws=>{
    socket=ws;
    const emit=(event,data)=>ws.send('42'+JSON.stringify([event,data]));
    ws.onMessage(message=>{
     const raw=String(message);
     if(raw.startsWith('40'))return ws.send('40'+JSON.stringify({sid:role+'-socket'}));
     if(raw==='2')return ws.send('3');
     const match=raw.match(/^42(\d*)(\[.*\])$/);if(!match)return;
     const [event,data]=JSON.parse(match[2]);
     const ack=data=>ws.send(`43${match[1]}[${JSON.stringify(data)}]`);
     if(event==='session:join')emit('session:state',{sessionId:id,mediaProvider:'realtimekit',startsAt,endsAt,serverNow:new Date().toISOString(),status:'active',participants:{tutorId:'tutor-parity',studentId:'student-parity'}});
     if(event==='classroom:request-activity-history'){
      historyReads++;
      emit('classroom:activity-history',Array.from({length:24},(_,i)=>({id:String(i),sessionId:id,userId:'fixture',userType:i%2?'student':'tutor',eventType:'entered',message:`${i%2?'Student':'Tutor'} entered the lesson room.`,createdAt:startsAt})));
     }
     if(event==='chat:request-history')emit('chat:history',[]);
     if(event==='classroom:media-token')ack({error:'No live media provider in isolated UI checks.'});
     if(event==='classroom:recording-state'){readCount++;ack({enabled:true,version:'notice-v1',retentionDays:30,accepted:consent,status});}
     if(event==='classroom:recording-consent'){consentWrites.push(data);consent=data.accepted;ack({enabled:true,version:'notice-v1',retentionDays:30,accepted:consent,status});}
    });
    ws.send('0'+JSON.stringify({sid:role+'-engine',upgrades:[],pingInterval:9000000,pingTimeout:9000000,maxPayload:1000000}));
   });
   const page=await context.newPage(),errors=[],failedRequests=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
   await page.goto(`${base}/classroom/${id}`,{waitUntil:'domcontentloaded'});
   const root=page.locator('.classroom-standardized');await expect(root).toBeVisible({timeout:30000}).catch(async error=>{
    console.error({role,width,theme,url:page.url(),body:await page.locator('body').innerText(),errors,failedRequests});
    await page.screenshot({path:`/tmp/fluentxverse-classroom-parity/${role}-load-failure.png`,fullPage:true});throw error;
   });
   await expect.poll(()=>readCount).toBeGreaterThan(0);
   await expect(page.getByRole('dialog',{name:'Lesson recording',exact:true})).toHaveCount(0);
   assert.deepEqual(consentWrites,[],'A passive notice never silently grants recording permission');
   await expect(root.getByRole('complementary',{name:'Lesson recording notice'})).toContainText('quality assurance');
   await expect(root.getByRole('button',{name:'Recording preferences',exact:true})).toBeVisible();
   const requestSection=root.locator('.lesson-request-section');await expect(requestSection).toBeVisible();
   if(role==='tutor'){
    await expect(root.getByText('Teaching cues',{exact:true})).toBeVisible();
    await expect(root.getByText(request.studentPreferences.otherRequests,{exact:true})).toBeVisible();
    await expect(root.getByTitle('Lesson notes',{exact:true})).toBeVisible();
   }else{
    await expect(root.getByText('Teaching cues',{exact:true})).toHaveCount(0);
    await expect(root.locator('.dispatch-notes-fab,.dispatch-notes-widget')).toHaveCount(0);
   }
   const scrolling=await root.locator('.lesson-request-section,.lesson-request-body,.lesson-request-content,.lesson-request-details,.student-preferences-sidebar').evaluateAll(elements=>elements.map(el=>({class:el.className,overflow:getComputedStyle(el).overflowY,client:el.clientHeight,scroll:el.scrollHeight})));
   assert.ok(scrolling.every(el=>el.overflow==='visible'&&el.scroll<=el.client+1),JSON.stringify(scrolling));
   styles[role]=await root.evaluate(el=>{
    const style=selector=>{const node=el.querySelector(selector),s=getComputedStyle(node),r=node.getBoundingClientRect();return {height:Math.round(r.height),width:Math.round(r.width),bg:s.backgroundColor,image:s.backgroundImage,color:s.color,radius:s.borderRadius,padding:s.padding,font:s.fontFamily,fontSize:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,box:s.boxSizing};};
    const request=style('.lesson-request-header');delete request.height;
    const workspace=style('.lesson-request-container');delete workspace.height;
    return {header:style('.classroom-header'),left:style('.classroom-left'),right:style('.classroom-right'),video:style('.video-section'),chat:style('.chat-header'),composer:style('.chat-input-area'),attach:style('.attach-btn'),send:style('.send-btn'),controls:style('.control-btn'),topbar:style('.material-topbar'),request,workspace};
   });
   for(const img of await root.locator('.classroom-logo img,.lesson-request-title img').all())await expect.poll(()=>img.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
   await page.screenshot({path:`/tmp/fluentxverse-classroom-parity/${role}-${width}-${theme}.png`,fullPage:true});
   await root.getByRole('button',{name:'Classroom history',exact:true}).click();
   const history=page.getByRole('dialog',{name:'History',exact:true});await expect(history).toBeVisible();
   await expect(history.locator('.classroom-history-item')).toHaveCount(24);
   const panelMetrics=await history.evaluate(el=>{
    const r=el.getBoundingClientRect(),left=el.closest('.classroom-left')?.getBoundingClientRect(),list=el.querySelector('.classroom-history-list'),s=getComputedStyle(el);
    return {width:Math.round(r.width),height:Math.round(r.height),x:Math.round(r.x),leftWidth:left?.width,leftX:left?.x,listClient:list.clientHeight,listScroll:list.scrollHeight,bg:s.backgroundColor,color:s.color,padding:s.padding,radius:s.borderRadius};
   });
   assert.ok(panelMetrics.leftWidth&&Math.abs(panelMetrics.width-panelMetrics.leftWidth)<2,JSON.stringify(panelMetrics));
   assert.ok(Math.abs(panelMetrics.x-panelMetrics.leftX)<2&&panelMetrics.height<=360,JSON.stringify(panelMetrics));
   assert.ok(panelMetrics.listScroll>panelMetrics.listClient&&panelMetrics.listClient<=220);
   const previousReads=historyReads;await history.getByRole('button',{name:'Refresh',exact:true}).click();
   await expect.poll(()=>historyReads).toBeGreaterThan(previousReads);await expect(history).toBeVisible();
   styles[role].history=panelMetrics;
   await page.screenshot({path:`/tmp/fluentxverse-classroom-parity/${role}-${width}-${theme}-history.png`,fullPage:true});
   await page.keyboard.press('Escape');await expect(history).toHaveCount(0);
   await expect(root.getByRole('button',{name:'Classroom history',exact:true})).toBeFocused();
   await root.getByRole('button',{name:'Device settings',exact:true}).click();
   const settings=page.getByRole('dialog',{name:'Settings',exact:true});await expect(settings).toBeVisible();
   styles[role].settings=await settings.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {width:Math.round(r.width),height:Math.round(r.height),bg:s.backgroundColor,color:s.color,padding:s.padding,radius:s.borderRadius};});
   assert.ok(await settings.evaluate(el=>Boolean(el.closest('.classroom-left'))&&el.scrollWidth<=el.clientWidth));
   await settings.getByRole('button',{name:'Close settings',exact:true}).click();await expect(settings).toHaveCount(0);
   await root.getByRole('button',{name:'Recording preferences',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Lesson recording',exact:true});await expect(dialog).toBeVisible();
   await expect(dialog.getByRole('button',{name:'Agree',exact:true})).toBeDisabled();
   await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Agree',exact:true}).click();
   await expect(dialog).toHaveCount(0);assert.equal(consentWrites.length,1);assert.equal(consentWrites[0].authority,true);
   if(role==='tutor'){
    await root.getByTitle('Lesson notes',{exact:true}).click();await expect(root.locator('.dispatch-notes-widget')).toBeVisible();
    await root.locator('.dispatch-notes-close').click();
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.goto(`${base}/lesson/${id}`,{waitUntil:'networkidle'});
   await expect(page.getByRole('complementary',{name:'Lesson recording notice'})).toContainText('quality assurance').catch(async error=>{console.error(role,page.url(),await page.locator('body').innerText(),errors);throw error;});
   assert.deepEqual(errors,[]);await context.close();
  }
  const differences=Object.keys(styles.student).filter(key=>JSON.stringify(styles.tutor[key])!==JSON.stringify(styles.student[key])).map(key=>({key,tutor:styles.tutor[key],student:styles.student[key]}));
  assert.deepEqual(differences,[],`Shared classroom differences at ${width}px ${theme}: ${JSON.stringify(differences)}`);
  console.log(`PASS ${width}px ${theme}: matching classroom shell, tutor-only cues/notes, no nested request scroll, QA notices and explicit recording permissions`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
