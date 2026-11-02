const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const bases={tutor:process.env.TUTOR_TEST_URL||'http://127.0.0.1:5286',student:process.env.STUDENT_TEST_URL||'http://127.0.0.1:5287'};
const id='private-preview-fixture';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 fs.mkdirSync('/tmp/fluentxverse-readiness',{recursive:true});
 try{for(const role of ['tutor','student'])for(const provider of ['webrtc','realtimekit']){
  const base=bases[role],context=await browser.newContext({viewport:{width:role==='tutor'?1440:390,height:1000},permissions:['camera','microphone'],reducedMotion:'reduce'});
  await context.addInitScript(()=>{
   localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:'dark',isDarkMode:true},version:2}));
   window.__streams=[];window.__deviceCalls=0;window.__peers=0;window.__deny=false;window.__hold=false;
   const acquire=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   navigator.mediaDevices.getUserMedia=async constraints=>{
    window.__deviceCalls++;
    if(window.__hold)await new Promise(resolve=>window.__releaseMedia=resolve);
    if(window.__deny)throw new DOMException('Fixture permission denied','NotAllowedError');
    const stream=await acquire(constraints);window.__streams.push(stream);return stream;
   };
   const Peer=window.RTCPeerConnection;window.RTCPeerConnection=class extends Peer{constructor(config){super(config);window.__peers++;}};
  });
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url()),p=url.pathname;
   if(url.origin===base)return route.continue();
   if(!['api.fluentxverse.com','api.fluentxverse.xyz','localhost','127.0.0.1'].includes(url.hostname))return route.fulfill({json:{}});
   assert(['GET','OPTIONS'].includes(request.method())||['/tutor/refresh','/student/refresh','/schedule/preload'].includes(p),'Unexpected fixture write: '+p);
   const user={userId:role+'-preview',id:role+'-preview',role,firstName:'Alex',email:'test@example.invalid'};
   let data=[];
   if(p.endsWith('/socket-token'))return route.fulfill({json:{success:true,token:'fixture'}});
   if(p==='/notifications')data={notifications:[],unreadCount:0};
   if(p==='/tutor/email-verification')data={verified:true};
   if(p.startsWith('/tutor/classroom-lesson-notes/'))data={materials:[],studentComment:'',tutorMemo:'',englishLevelAssessment:null,updatedAt:null};
   if(p.includes('/lesson-request'))data={studentPreferences:{cameraOn:true},courseId:'',lessonId:''};
   if(p.includes('/trouble-report')||p.includes('/issue-report'))data={canReport:false,eligible:false};
   if(p.endsWith('/survey'))data={eligible:false};
   if(p==='/proof/tutor-certification/me')data={snapshot:{writtenPassed:true,speakingPassed:true,interviewPassed:true,profileApproved:true,missingRequirements:[]}};
   return route.fulfill({json:{success:true,user,data,articles:[],lessons:[]}});
  });
  let emit,join=0;const events=[];
  await context.routeWebSocket('**/socket.io/**',ws=>{
   emit=(event,data)=>ws.send('42'+JSON.stringify([event,data]));
   ws.onMessage(raw=>{
    raw=String(raw);
    if(raw.startsWith('40'))return ws.send('40{"sid":"preview-socket"}');
    if(raw==='2')return ws.send('3');
    const match=raw.match(/^42(\d*)(\[.*\])$/);if(!match)return;
    const [event]=JSON.parse(match[2]);events.push(event);
    if(event==='session:join')join++;
    if(event==='webrtc:ice-config'&&match[1])ws.send('43'+match[1]+'[{"iceServers":[]}]');
    if(event==='classroom:media-token'&&match[1])ws.send('43'+match[1]+'[{"error":"No SDK transport in isolated test."}]');
    if(event==='chat:request-history')emit('chat:history',[]);
   });
   ws.send('0{"sid":"preview-engine","upgrades":[],"pingInterval":9000000,"pingTimeout":9000000,"maxPayload":1000000}');
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')console.log('Browser '+role+': '+message.text());});
  await page.goto(base+'/classroom/'+id,{waitUntil:'domcontentloaded'});
  await expect.poll(()=>join,{timeout:15000}).toBeGreaterThan(0).catch(async error=>{console.error({role,provider,url:page.url(),body:await page.locator('body').innerText(),errors,events});throw error;});
  assert.equal(await page.evaluate(()=>window.__deviceCalls),0,'Do not request permissions before authorized room state');
  const state=live=>({sessionId:id,mediaProvider:provider,startsAt:new Date(Date.now()+(live?-1000:120000)).toISOString(),endsAt:new Date(Date.now()+1500000).toISOString(),serverNow:new Date().toISOString(),participants:{tutorId:'tutor-preview',studentId:'student-preview'},status:'active'});
  emit('session:state',state(false));
  await expect(page.locator('.classroom-device-preview')).toContainText('Device preview is private.');
  assert.equal(await page.evaluate(()=>window.__deviceCalls),1);
  assert.equal(await page.evaluate(()=>window.__streams[0].getTracks().filter(t=>t.readyState==='live').length),2);
  emit('webrtc:ready',{from:role==='tutor'?'student-preview':'tutor-preview'});
  emit('webrtc:offer',{offer:{type:'offer',sdp:''},from:'uninvited'});
  assert.equal(await page.evaluate(()=>window.__peers),0);
  assert.equal(events.filter(e=>['webrtc:ready','webrtc:offer','webrtc:ice-config','classroom:media-token'].includes(e)).length,0,'No pre-start transport or publishing');
  await page.screenshot({path:'/tmp/fluentxverse-readiness/'+role+'-'+provider+'.png',fullPage:true});
  emit('session:state',state(true));
  await expect(page.locator('.classroom-device-preview')).toHaveCount(0);
  if(provider==='realtimekit'){
   await expect.poll(()=>events.filter(e=>e==='classroom:media-token').length).toBeGreaterThan(0);
   await expect.poll(()=>page.evaluate(()=>window.__streams.every(s=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  }else{
   if(role==='tutor')emit('webrtc:ready',{from:'student-preview'});
   await expect.poll(()=>events.filter(e=>e===(role==='tutor'?'webrtc:offer':'webrtc:ready')).length).toBeGreaterThan(0);
   assert.equal(await page.evaluate(()=>window.__deviceCalls),1,'Reuse the warmed WebRTC stream at lesson start');
  }
  emit('session:classroom-closed',{sessionId:id});
  await expect.poll(()=>page.evaluate(()=>window.__streams.every(s=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  assert.deepEqual(errors,[]);
  // A failed permission prompt must be recoverable without reloading the room.
  await page.reload({waitUntil:'domcontentloaded'});await expect.poll(()=>join).toBeGreaterThan(1);
  await page.evaluate(()=>window.__deny=true);emit('session:state',state(false));
  const retry=page.getByRole('button',{name:'Retry devices',exact:true});await expect(retry).toBeVisible();
  await page.evaluate(()=>window.__deny=false);await retry.click();
  await expect(page.locator('.classroom-device-preview')).toContainText('Device preview is private.');
  emit('session:error',{message:'Room access revoked'});
  await expect.poll(()=>page.evaluate(()=>window.__streams.every(s=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  // Late permission resolutions cannot keep the hardware active after room closure.
  await page.evaluate(()=>window.__hold=true);emit('session:state',state(false));
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__releaseMedia))).toBe(true);
  emit('session:classroom-closed',{sessionId:id});await expect(page.locator('.classroom-device-preview')).toHaveCount(0);
  await page.evaluate(()=>window.__releaseMedia());
  await expect.poll(()=>page.evaluate(()=>window.__streams.length)).toBe(2);
  await expect.poll(()=>page.evaluate(()=>window.__streams.every(s=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  await page.reload({waitUntil:'domcontentloaded'});await expect.poll(()=>join).toBeGreaterThan(2);
  emit('session:state',state(false));await expect(page.locator('.classroom-device-preview')).toContainText('Device preview is private.');
  await page.getByRole('button',{name:'Device settings',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Settings',exact:true});await expect(settings).toBeVisible();
  await page.evaluate(()=>window.__hold=true);await settings.getByRole('button',{name:'Apply',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__releaseMedia))).toBe(true);
  emit('session:classroom-closed',{sessionId:id});await expect(page.locator('.classroom-device-preview')).toHaveCount(0);
  await page.evaluate(()=>window.__releaseMedia());
  await expect.poll(()=>page.evaluate(()=>window.__streams.length)).toBe(2);
  await expect.poll(()=>page.evaluate(()=>window.__streams.every(s=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS '+role+' '+provider+': private preview, start gate, handoff, permission retry, revoked access, late acquisition and late device-switch cleanup');
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
