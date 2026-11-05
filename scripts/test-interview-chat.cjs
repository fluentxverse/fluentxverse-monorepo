const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const tutorBase=process.env.INTERVIEW_TUTOR_URL||'http://127.0.0.1:5284';
const adminBase=process.env.INTERVIEW_DASHBOARD_URL||'http://127.0.0.1:5285';

(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 fs.mkdirSync('/tmp/fluentxverse-interview-chat',{recursive:true});
 try{for(const width of [1440,390,320])for(const theme of ['light','dark']){
  const members=new Map(),errors=[],writes=[];
  let ended=false;
  let denyAdminOnce=process.env.INTERVIEW_DENIAL_TEST==='true';
  const create=async(role,base)=>{
   const context=await browser.newContext({viewport:{width,height:950},permissions:['camera','microphone'],reducedMotion:'reduce'});
   await context.addInitScript(theme=>{
    localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2}));
    window.__streams=[];window.__peers=[];
    const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await get(constraints);window.__streams.push(stream);return stream;};
    const Peer=window.RTCPeerConnection;
    window.RTCPeerConnection=class extends Peer{constructor(config){super(config);window.__peers.push(this);}};
   },theme);
   await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname.replace(/^\/api/,'');
    if(url.origin===base)return route.continue();
    if(request.method()!=='GET'&&request.method()!=='OPTIONS')writes.push(path);
    const user={userId:role+'-chat-fixture',firstName:'Alex',role:role==='admin'?'superadmin':'tutor',username:'Reviewer',email:'test@example.invalid'};
    let data=[];
    if(path.startsWith('/interview/room/'))data={id:'chat-fixture',tutorId:'tutor-chat-fixture',tutorName:'Candidate',status:ended?'completed':'booked',mediaClosed:ended};
    if(path==='/tutor-identity/admin')data=[{id:'synthetic-id',tutorId:'tutor-chat-fixture',idType:'passport',status:'booked',bookingDeadline:new Date(Date.now()+86400000).toISOString()}];
    if(path==='/notifications')data={notifications:[],unreadCount:0};
    if(path.replace(/\/$/,'')==='/tutor/email-verification')data={verified:true};
    return route.fulfill({json:{success:true,user,data,token:'fixture.token.value'}});
   });
   await context.routeWebSocket(/socket\.io/,ws=>{
    const emit=(event,data)=>ws.send('42'+JSON.stringify([event,data]));
    ws.send('0'+JSON.stringify({sid:'engine-'+role,upgrades:[],pingInterval:120000,pingTimeout:120000,maxPayload:1000000}));
    ws.onMessage(raw=>{
     const packet=String(raw);
     if(packet.startsWith('40')){ws.send('40'+JSON.stringify({sid:'peer-'+role}));return;}
     if(!packet.startsWith('42'))return;
     const [event,data]=JSON.parse(packet.slice(2)),other=members.get(role==='admin'?'tutor':'admin');
     if(event==='interview:join'){
      if(role==='admin'&&denyAdminOnce){denyAdminOnce=false;emit('interview:error',{message:'This interview opens at 11:15 PM Manila time, 15 minutes before the scheduled start. Please try again then.'});return;}
      members.set(role,{emit,ws});
      emit('interview:joined',{roomId:data.roomId,configuration:{iceServers:[]},peerPresent:Boolean(other),peerId:other?'peer-'+(role==='admin'?'tutor':'admin'):undefined});
      if(other)other.emit(role==='admin'?'interview:admin-joined':'interview:tutor-joined',{peerId:'peer-'+role});
     }else if(event==='interview:end'){
      ended=true;emit('interview:ended');other?.emit('interview:ended');
     }else if(['interview:offer','interview:answer','interview:ice-candidate','interview:renegotiate'].includes(event))other?.emit(event,{...data,from:'peer-'+role});
    });
    ws.onClose(()=>{if(members.get(role)?.ws===ws){members.delete(role);members.get(role==='admin'?'tutor':'admin')?.emit(role==='admin'?'interview:admin-left':'interview:tutor-left');}});
   });
   const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(role+': '+error.message));
   return {page,context};
  };
  const tutor=await create('tutor',tutorBase),admin=await create('admin',adminBase);
  const join=async(page,url)=>{await page.goto(url,{waitUntil:'domcontentloaded'});await expect(page.locator('.btn-join')).toBeEnabled({timeout:20000});await page.locator('.btn-join').click();await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);};
  try{
   await join(tutor.page,tutorBase+'/interview/room/chat-fixture');
   await expect(tutor.page.getByRole('button',{name:'Send message',exact:true})).toBeDisabled();
   await join(admin.page,adminBase+'/interview-room/chat-fixture');
   if(process.env.INTERVIEW_DENIAL_TEST==='true'){
    await expect(admin.page.locator('.setup-error')).toContainText('opens at 11:15 PM');
    await expect(admin.page.locator('.setup-error')).not.toContainText('Failed to join interview room');
    await expect(admin.page.locator('.btn-join')).toBeEnabled();await admin.page.locator('.btn-join').click();
   }
   await expect(admin.page.getByRole('heading',{name:'Philippine Passport',exact:true})).toBeVisible();
   await admin.page.getByRole('tab',{name:'Chat',exact:true}).click();
   for(const {page}of[tutor,admin])await expect(page.locator('.interview-chat header')).toContainText('Connected',{timeout:20000});
   const input=tutor.page.getByRole('textbox',{name:'Message',exact:true});
   await input.fill('First line');await input.press('Enter');await input.pressSequentially('Second line');
   await expect(input).toHaveValue('First line\nSecond line');
   await expect(admin.page.locator('.interview-chat-message')).toHaveCount(0);
   await tutor.page.getByRole('button',{name:'Send message',exact:true}).click();
   await expect(admin.page.locator('.interview-chat-message p')).toHaveText('First line\nSecond line',{useInnerText:true});
   await expect(input).toHaveValue('');
   const markup='<img src=x onerror=alert(1)>\nReply from interviewer';
   await admin.page.getByRole('textbox',{name:'Message',exact:true}).fill(markup);
   await admin.page.getByRole('button',{name:'Send message',exact:true}).click();
   await expect(tutor.page.locator('.interview-chat-message p').last()).toHaveText(markup,{useInnerText:true});
   assert.equal(await tutor.page.locator('.interview-chat-message img').count(),0);
   assert.equal(await tutor.page.locator('input[type=file]').count(),0);
   await input.fill('  \n  ');await expect(tutor.page.getByRole('button',{name:'Send message',exact:true})).toBeDisabled();
   await input.fill('Keep my draft');
   await input.evaluate(el=>{const files=new DataTransfer();files.items.add(new File(['test'],'test.txt',{type:'text/plain'}));const event=new ClipboardEvent('paste',{clipboardData:files,bubbles:true,cancelable:true});el.dispatchEvent(event);if(!event.defaultPrevented)throw Error('File paste was not blocked');});
   tutor.page.once('dialog',dialog=>dialog.dismiss());await tutor.page.getByRole('button',{name:'Return Home',exact:true}).click();assert(tutor.page.url().includes('/interview/room/'));
   await admin.page.reload({waitUntil:'domcontentloaded'});
   await expect(tutor.page.locator('.interview-chat header')).toContainText('Waiting for connection');
   await expect(input).toHaveValue('Keep my draft');
   await expect(admin.page.locator('.btn-join')).toBeEnabled();await admin.page.locator('.btn-join').click();
   await admin.page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
   await admin.page.getByRole('tab',{name:/^Chat/}).click();
   for(const {page}of[tutor,admin])await expect(page.locator('.interview-chat header')).toContainText('Connected',{timeout:20000});
   await tutor.page.getByRole('button',{name:'Send message',exact:true}).click();
   await expect(admin.page.locator('.interview-chat-message p').last()).toHaveText('Keep my draft');
   for(const [role,{page}]of[['tutor',tutor],['admin',admin]]){
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,role+' horizontal overflow');
    const composer=page.getByRole('textbox',{name:'Message',exact:true});
    await composer.scrollIntoViewIfNeeded();
    assert(await composer.evaluate(el=>{const rect=el.getBoundingClientRect();return document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)===el;}),role+' composer is not clipped');
    await page.getByRole('button',{name:'Send message',exact:true}).scrollIntoViewIfNeeded();
    if(role==='admin'){
     const framing=await page.locator('.video-container.remote').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return Math.abs(r.width-p.width)<2&&Math.abs(r.height-p.height)<2;});
     assert.equal(framing,true,'remote video should fill its stage');
     await page.getByRole('tab',{name:'Evaluation',exact:true}).click();
     await page.locator('.btn-pass').scrollIntoViewIfNeeded();
     await expect(page.locator('.btn-pass')).toBeInViewport();
     await page.getByRole('tab',{name:'Identity',exact:true}).click();
     await page.getByRole('button',{name:'Start unrecorded ID check',exact:true}).scrollIntoViewIfNeeded();
     await expect(page.getByRole('button',{name:'Start unrecorded ID check',exact:true})).toBeInViewport();
     await page.locator('.interview-tool-panel:not([hidden])').evaluate(el=>el.scrollTop=0);
    }
    await page.evaluate(()=>window.scrollTo(0,0));
    if(role==='tutor')await page.locator('.interview-chat').evaluate(el=>el.scrollIntoView({block:'nearest'}));
    await page.screenshot({path:`/tmp/fluentxverse-interview-chat/${role}-${width}-${theme}.png`,fullPage:true});
   }
   await tutor.page.getByTitle('Leave interview',{exact:true}).click();
   await admin.page.getByRole('tab',{name:/^Chat/}).click();
   for(const {page}of[tutor,admin]){
    await expect(page.locator('.interview-chat header')).toContainText('Interview ended');
    await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeDisabled();
    assert.equal(await page.evaluate(()=>window.__streams.flatMap(stream=>stream.getTracks()).filter(track=>track.readyState==='live').length),0);
   }
   await tutor.page.getByRole('button',{name:'Return Home',exact:true}).click();await expect(tutor.page).toHaveURL(tutorBase+'/home');
   await tutor.page.goto(tutorBase+'/interview/room/chat-fixture');
   await expect(tutor.page.getByRole('button',{name:'Return Home',exact:true})).toBeVisible();
   await expect(tutor.page.locator('.call-status')).toContainText('Interview ended');
   assert.equal(await tutor.page.evaluate(()=>window.__streams.length),0,'Ended interview must not acquire media');
   assert.deepEqual(errors,[]);assert(writes.every(path=>path==='/tutor/refresh'),'Only mocked session renewal may use POST');
   console.log(`PASS ${width}px ${theme}: real WebRTC multiline chat both ways, literal text, no files, reconnect/draft retention, closed media and Tutor Home return`);
  }catch(error){console.error({errors,tutor:await tutor.page.locator('body').innerText(),admin:await admin.page.locator('body').innerText()});throw error;}
  finally{await tutor.context.close();await admin.context.close();}
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
