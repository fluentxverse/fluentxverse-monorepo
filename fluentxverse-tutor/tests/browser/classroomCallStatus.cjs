// Run with both apps on ports 5173/5174 and Playwright installed; PLAYWRIGHT_MODULE can specify its module path.
// CLASSROOM_TURN_TEST=all|udp|tcp|tls443 forces real Cloudflare relay traffic using the running server.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {resolve}=require('node:path');
const relayMode=process.env.CLASSROOM_TURN_TEST;
const rtkMode=process.env.CLASSROOM_RTK_TEST === '1';
const qaMode=process.env.CLASSROOM_QA_TEST === '1';
assert(!qaMode || rtkMode,'QA recording test requires RealtimeKit');
const qaConsents=new Map();
let qaRecordingId;
assert(!(rtkMode && relayMode),'Use one media provider per test');
let rtkFixture;
const serverDirectory=resolve(__dirname,'../../../fluentxverse-server');
const runRtk=code=>execFileSync('bun',['-e',`import {RealtimeKitClient} from './src/services/realtimekit.client'; const client=new RealtimeKitClient(); ${code}`],{cwd:serverDirectory,encoding:'utf8'});
if(rtkMode) {
  // Child stdout is parsed in memory; neither provider secrets nor tokens are logged or saved.
  rtkFixture=JSON.parse(runRtk(`const meeting=await client.ensureMeeting('smoke-'+crypto.randomUUID()); try { const tutor=await client.ensureParticipant(meeting,'tutor-smoke','tutor'); const student=await client.ensureParticipant(meeting,'student-smoke','student'); console.log(JSON.stringify({meeting,tutor,student})); } catch(error) { await client.closeMeeting(meeting); throw error; }`));
}
let relayConfigurations;
if(relayMode) {
  assert(['all','udp','tcp','tls443'].includes(relayMode),'Unknown TURN test mode');
  // Retrieve only short-lived credentials from the running server; never read its API token.
  relayConfigurations=JSON.parse(execFileSync('docker',['exec','fluentxverse-server','bun','-e',
    'import {getIceConfiguration} from "./src/socket/iceConfiguration"; const roles=["student","tutor"]; const entries=await Promise.all(roles.map(async role=>[role,await getIceConfiguration(`relay-smoke-${role}`)])); console.log(JSON.stringify(Object.fromEntries(entries)));'
  ],{encoding:'utf8'}));
  const urls={udp:'turn:turn.cloudflare.com:3478?transport=udp',tcp:'turn:turn.cloudflare.com:3478?transport=tcp',tls443:'turns:turn.cloudflare.com:443?transport=tcp'};
  for(const config of Object.values(relayConfigurations)) {
    if(relayMode!=='all')config.iceServers=config.iceServers.map(server=>({...server,urls:[].concat(server.urls).filter(url=>url.startsWith('stun:') || url===urls[relayMode])})).filter(server=>server.urls.length);
    assert(config.iceServers.some(server=>[].concat(server.urls).some(url=>/^turns?:/.test(url))),'TURN credentials are missing');
  }
}
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const peers=new Map();
  const waitingMode = process.env.CLASSROOM_WAITING_TEST === '1';
  const wrapUpMode = process.env.CLASSROOM_WRAP_UP_TEST === '1';
  let overrideEndsAt;
  let preparing = true;
  let startsAt = new Date(Date.now() - 300000).toISOString();
  const earlySignals = [];
  const packet=(event,data)=>'42'+JSON.stringify([event,data]);
  const broadcastState=()=>{
    const participants={};
    for(const role of peers.keys())participants[`${role}Id`]=`${role}-smoke`;
    for(const ws of peers.values())ws.send(packet('session:state',{sessionId:'call-status-smoke',mediaProvider:rtkMode?'realtimekit':'webrtc',startsAt,endsAt:overrideEndsAt || new Date(Date.parse(startsAt)+1500000).toISOString(),serverNow:new Date().toISOString(),status:peers.size===2?'active':'waiting',participants}));
  };
  async function open(role, denied=false) {
    const mobileTutor = process.env.CLASSROOM_MOBILE_TUTOR === '1';
    const context=await browser.newContext({viewport:{width:(role==='tutor')!==mobileTutor?1566:375,height:900},permissions:['camera','microphone']});
    await context.addInitScript(theme => {
      // SDK sandbox frames intentionally deny storage; fixtures belong to the app frame.
      if (window.top !== window || !['http:', 'https:'].includes(location.protocol)) return;
      localStorage.setItem('theme-storage', JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2}));
    }, process.env.CLASSROOM_THEME || 'light');
    await context.addInitScript(({denied,relayMode})=>{
      if (window.top !== window || !['http:', 'https:'].includes(location.protocol)) return;
      window.__pcs=[];
      const Original=window.RTCPeerConnection;
      window.__iceErrors=[];
      window.RTCPeerConnection=class extends Original {constructor(config){super({...config,...(relayMode?{iceTransportPolicy:'relay'}:{})});window.__pcs.push(this);this.addEventListener('icecandidateerror',event=>window.__iceErrors.push({url:event.url,code:event.errorCode}));}};
      if(denied)navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Permission denied','NotAllowedError');};
    },{denied,relayMode});
    await context.route(/^(https:\/\/api\.fluentxverse\.(?:com|xyz)|http:\/\/(localhost|127\.0\.0\.1):8765)\//,route=>{
      const path=new URL(route.request().url()).pathname;
      const user={userId:`${role}-smoke`,email:'paulanthonyarriola@gmail.com',role,givenName:'Smoke',firstName:'Smoke',tier:1};
      let json={success:true,data:[],profile:{},user};
      if(path.endsWith('/socket-token'))json={success:true,token:'test-only-token'};
      if(path==='/schedule/week')json={success:true,data:{slots:[],weekStart:'2026-10-05',weekEnd:'2026-10-11'}};
      if(path==='/notifications')json={success:true,data:{notifications:[],unreadCount:0}};
      if(path==='/notifications/unread-count')json={success:true,data:{unreadCount:0}};
      if(path.startsWith('/tutor/classroom-lesson-notes/'))json={success:true,data:{materials:[],studentComment:'',tutorMemo:'',updatedAt:null}};
      if(path.endsWith('/issue-report') || path.endsWith('/trouble-report'))json={success:true,data:{startsAt:new Date(Date.now()-300000).toISOString(),endsAt:new Date(Date.now()+1200000).toISOString(),lessonEndsAt:new Date(Date.now()+1200000).toISOString(),closesAt:new Date(Date.now()+172800000).toISOString(),serverNow:new Date().toISOString(),eligible:false,reason:'tutor_joined',report:null}};
      return route.fulfill({json});
    });
    await context.routeWebSocket('**/socket.io/**',ws=>{
      ws.onMessage(message=>{
        const raw=String(message);
        if(raw.startsWith('40'))return ws.send('40'+JSON.stringify({sid:`socket-${role}`}));
        if(raw==='2')return ws.send('3');
        const match=raw.match(/^42(\d*)(\[.*\])$/);
        if(!match)return;
        const [event,data]=JSON.parse(match[2]);
        const other=role==='tutor'?'student':'tutor';
        if(event==='session:join'){
          if(waitingMode && preparing && peers.size===0)startsAt=new Date(Date.now()+20000).toISOString();
          peers.set(role,ws);broadcastState();
        }
        if(event.startsWith('webrtc:') && event!=='webrtc:ice-config' && Date.now()<Date.parse(startsAt))earlySignals.push(event);
        if(event==='chat:send')for(const peer of peers.values())peer.send(packet('chat:message',{id:'waiting-chat',sessionId:'call-status-smoke',senderType:role,senderId:`${role}-smoke`,text:data.text,timestamp:new Date().toISOString()}));
        if(event==='webrtc:ice-config' && match[1])ws.send(`43${match[1]}[${JSON.stringify(relayConfigurations?.[role] || {iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]})}]`);
        if(event==='classroom:media-token' && match[1] && rtkMode) {
          const token=JSON.parse(runRtk(`console.log(JSON.stringify(await client.refreshToken(${JSON.stringify(rtkFixture.meeting)},${JSON.stringify(rtkFixture[role].id)})));`));
          ws.send(`43${match[1]}[${JSON.stringify({provider:'realtimekit',token,serverNow:new Date().toISOString(),closesAt:new Date(Date.now()+1200000).toISOString()})}]`);
        }
        if(['classroom:recording-state','classroom:recording-consent'].includes(event) && match[1]) {
          if(event==='classroom:recording-consent')qaConsents.set(role,data.accepted);
          ws.send(`43${match[1]}[${JSON.stringify({enabled:qaMode,version:'qa-local-30d-v1',retentionDays:30,accepted:qaConsents.get(role)??null,status:qaRecordingId?'recording':'waiting'})}]`);
        }
        if(event==='webrtc:ready')peers.get(other)?.send(packet(event,{from:`${role}-smoke`}));
        if(['webrtc:offer','webrtc:answer','webrtc:ice-candidate'].includes(event)) {
          peers.get(other)?.send(packet(event,{...data,from:`${role}-smoke`}));
          if(match[1])ws.send(`43${match[1]}[${JSON.stringify({delivered:peers.has(other)})}]`);
        }
      });
      ws.send('0'+JSON.stringify({sid:`engine-${role}`,upgrades:[],pingInterval:9000000,pingTimeout:9000000,maxPayload:1000000}));
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{
      if(message.type()==='error' && /ErrorBoundary|caught by|ReferenceError|TypeError|Cannot access/.test(message.text()))errors.push(message.text());
    });
    const base=process.env[role==='tutor'?'CLASSROOM_TUTOR_URL':'CLASSROOM_STUDENT_URL'] || `http://localhost:${role==='tutor'?5173:5174}`;
    await page.goto(`${base}/classroom/call-status-smoke`, {waitUntil:'domcontentloaded'});
    return {page,context,errors};
  }
  try {
    const tutor=await open('tutor');
    const banner=tutor.page.locator('[data-call-state]');
    let waitingStudent;
    if(waitingMode) {
      waitingStudent=await open('student');
      for(const item of [tutor,waitingStudent]) {
        await item.page.getByText(/Lesson starts in.*Chat and call unavailable/).waitFor();
        assert(await item.page.getByRole('textbox',{name:'Chat message. Press Shift and Enter for a new line.'}).isDisabled());
        assert(await item.page.getByTitle('Attach file',{exact:true}).isDisabled());
        assert(await item.page.getByTitle('Mute',{exact:true}).isDisabled());
        assert(await item.page.getByTitle('Turn off camera',{exact:true}).isDisabled());
        assert.equal(await item.page.evaluate(()=>window.__pcs.length),0,'No peer connection exists before start');
        assert.equal(await item.page.locator('.timer').textContent(),'00:00:00','The lesson timer does not run during preparation');
        await item.page.screenshot({path:`../output/screenshots/classroom-waiting-${item===tutor?'tutor':'student'}.png`});
      }
      assert.deepEqual(earlySignals,[],'No signaling can transmit media before the lesson');
      console.log('PASS: both waiting rooms block chat, files, microphone and camera transmission before start');
    } else {
      try { await banner.getByText('Ready. Waiting for student to connect...', {exact:true}).waitFor(); }
      catch(error) {
        console.error(JSON.stringify({banner:await banner.count()?await banner.textContent():null,pageErrors:tutor.errors}));
        await tutor.page.screenshot({path:'../output/screenshots/classroom-media-failure.png',timeout:5000}).catch(()=>{});
        throw error;
      }
    }
    assert.equal(await banner.locator('.spinner').count(),0);
    const reportNotice = { id:'student-report-one', type:'system', title:'Lesson report received', message:'Student reported an issue', data:{bookingId:'call-status-smoke'} };
    peers.get('tutor').send(packet('notification:new', reportNotice));
    await tutor.page.getByText('Report Received',{exact:true}).waitFor();
    await tutor.page.locator('.fxv-toast').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    await tutor.page.screenshot({path:'../output/screenshots/classroom-report-received.png'});
    peers.get('tutor').send(packet('notification:new', reportNotice));
    peers.get('tutor').send(packet('notification:new', {...reportNotice,id:'other-report',data:{bookingId:'another-lesson'}}));
    assert.equal(await tutor.page.getByText('Report Received',{exact:true}).count(),1,'Classroom reports are scoped and deduplicated');
    console.log('PASS: classroom report alert is visible, scoped to the lesson, and deduplicated');
    assert(await tutor.page.evaluate(()=>[...document.querySelectorAll('video')].some(video=>video.srcObject?.getAudioTracks().some(track=>track.readyState==='live'))));
    const student=waitingStudent || await open('student');
    for(const item of [tutor,student]) {
      try {
        await item.page.waitForFunction(()=>window.__pcs.some(pc=>pc.connectionState==='connected'),{},{timeout:30000});
      } catch(error) {
        for(const peer of [tutor,student])console.error(JSON.stringify(await peer.page.evaluate(async()=>({
          iceErrors:window.__iceErrors,
          peers:await Promise.all(window.__pcs.map(async pc=>({state:pc.connectionState,iceState:pc.iceConnectionState,gathering:pc.iceGatheringState,signaling:pc.signalingState,
            candidates:[...(await pc.getStats()).values()].filter(stat=>stat.type==='local-candidate' || stat.type==='remote-candidate' || stat.type==='candidate-pair').map(stat=>({type:stat.type,candidateType:stat.candidateType,relayProtocol:stat.relayProtocol,state:stat.state,nominated:stat.nominated,url:stat.url}))})))
        }))));
        throw error;
      }
      if(!rtkMode)assert(await item.page.evaluate(()=>window.__pcs.every(pc=>pc.getConfiguration().iceServers.some(server=>[].concat(server.urls).includes('stun:stun.cloudflare.com:3478')))));
      await item.page.locator('[data-call-state]').waitFor({state:'detached',timeout:rtkMode?30000:10000});
      await item.page.keyboard.press('a');
      assert(await item.page.evaluate(()=>[...document.querySelectorAll('video')].some(video=>!video.muted && video.srcObject?.getAudioTracks().some(track=>track.readyState==='live'))));
      await item.page.waitForFunction(async()=>{
        const stats=await Promise.all(window.__pcs.filter(pc=>pc.connectionState==='connected').map(pc=>pc.getStats()));
        return stats.some(report=>[...report.values()].some(stat=>stat.type==='inbound-rtp' && stat.kind==='audio' && stat.bytesReceived>0));
      });
      if(rtkMode) {
        await item.page.waitForFunction(async()=>{
          const stats=await Promise.all(window.__pcs.filter(pc=>pc.connectionState==='connected').map(pc=>pc.getStats()));
          return stats.some(report=>[...report.values()].some(stat=>stat.type==='inbound-rtp' && stat.kind==='video' && stat.framesDecoded>0));
        });
        await item.page.screenshot({path:`../output/screenshots/classroom-realtimekit-${item===tutor?'tutor':'student'}.png`});
      }
      if(relayMode) {
        await item.page.waitForFunction(async()=>{
          const stats=await window.__pcs.at(-1).getStats();
          return [...stats.values()].some(stat=>stat.type==='inbound-rtp' && stat.kind==='video' && stat.framesDecoded>0);
        });
        const selected=await item.page.evaluate(async()=>{
          const stats=await window.__pcs.at(-1).getStats();
          const transport=[...stats.values()].find(stat=>stat.type==='transport' && stat.selectedCandidatePairId);
          const pair=transport && stats.get(transport.selectedCandidatePairId);
          const local=pair && stats.get(pair.localCandidateId);
          const remote=pair && stats.get(pair.remoteCandidateId);
          return {localType:local?.candidateType,remoteType:remote?.candidateType,relayProtocol:local?.relayProtocol,bytesReceived:pair?.bytesReceived};
        });
        assert.equal(selected.localType,'relay');
        assert.equal(selected.remoteType,'relay');
        assert(selected.bytesReceived>0);
        console.log(`PASS: ${item===tutor?'tutor':'student'} ${relayMode} selected relay-to-relay media path: ${JSON.stringify(selected)}`);
        await item.page.screenshot({path:`../output/screenshots/classroom-relay-${item===tutor?'tutor':'student'}-${relayMode}.png`});
      }
      assert.deepEqual(item.errors,[]);
    }
    console.log('PASS: local devices ready without spinner; actual two-peer audio/video connection; Connected banners hide on both apps');
    if(qaMode) {
      for(const item of [tutor,student]) {
        const notice=item.page.getByRole('region',{name:'Lesson recording'});
        await notice.getByText(/encrypted copy is stored/).waitFor();
        await notice.getByRole('checkbox').check();
        await notice.getByRole('button',{name:'Agree to recording',exact:true}).click();
        await notice.getByRole('button',{name:'Withdraw recording permission'}).waitFor();
      }
      assert.equal(qaConsents.size,2);
      const live=JSON.parse(runRtk(`console.log(JSON.stringify(await client.liveParticipantIds(${JSON.stringify(rtkFixture.meeting)})));`));
      assert.equal(live.length,2,'Provider must verify two actual live participants');
      qaRecordingId=JSON.parse(runRtk(`const recording=await client.startRecording(${JSON.stringify(rtkFixture.meeting)},300); console.log(JSON.stringify(recording.id));`));
      for(let attempt=0;attempt<24;attempt++) {
        const status=JSON.parse(runRtk(`console.log(JSON.stringify((await client.recording(${JSON.stringify(qaRecordingId)})).status));`));
        if(status==='RECORDING')break;
        assert(status!=='ERRORED','Cloudflare recording failed');
        if(attempt===23)throw new Error('Cloudflare recording did not start');
        await tutor.page.waitForTimeout(5000);
      }
      await tutor.page.waitForTimeout(8000);
      console.log('PASS: both classroom recording notices acknowledged; provider verified live participants and RECORDING state');
    }
    if(waitingMode) {
      assert.deepEqual(earlySignals,[]);
      for(const item of [tutor,student])assert(await item.page.getByRole('textbox',{name:'Chat message. Press Shift and Enter for a new line.'}).isEnabled());
      await tutor.page.getByRole('textbox',{name:'Chat message. Press Shift and Enter for a new line.'}).fill('Lesson has started');
      await tutor.page.locator('.send-btn').click();
      await student.page.getByText('Lesson has started',{exact:true}).waitFor();
      console.log('PASS: scheduled start automatically unlocks both classrooms, connects the call and permits chat without reload');
    }
    await tutor.page.locator('.video-section').hover();
    await tutor.page.getByTitle('Turn off camera',{exact:true}).click();
    await tutor.page.getByTitle('Turn on camera',{exact:true}).waitFor();
    assert.equal(await tutor.page.locator('[data-call-state]').count(),0);
    assert(await tutor.page.evaluate(()=>window.__pcs.at(-1).connectionState==='connected'));
    console.log('PASS: turning off the camera does not show a false connecting banner');
    if(rtkMode) {
      await student.page.reload({waitUntil:'domcontentloaded'});
      // A detached banner on an empty page is not proof that the reloaded call is ready.
      await student.page.waitForFunction(()=>[...document.querySelectorAll('video')].some(video=>video.srcObject?.getAudioTracks().some(track=>track.readyState==='live')));
      await student.page.waitForFunction(()=>window.__pcs.some(pc=>pc.connectionState==='connected'));
      for(const item of [tutor,student])await item.page.locator('[data-call-state]').waitFor({state:'detached',timeout:30000});
      await student.page.keyboard.press('a');
      await tutor.page.getByTitle('Turn on camera',{exact:true}).click();
      await student.page.waitForFunction(()=>[...document.querySelectorAll('video')].some(video=>!video.muted && video.srcObject?.getVideoTracks().some(track=>track.readyState==='live')));
      console.log('PASS: RealtimeKit call survives student refresh; camera can be re-enabled');
      for(const item of [tutor,student]) {
        await item.page.locator('.video-section').hover();
        await item.page.getByTitle('Mute',{exact:true}).click();
        await item.page.waitForFunction(()=>[...document.querySelectorAll('video')].some(video=>video.muted && video.srcObject && video.srcObject.getAudioTracks().length===0));
        await item.page.getByTitle('Unmute',{exact:true}).click();
        await item.page.waitForFunction(()=>[...document.querySelectorAll('video')].some(video=>video.muted && video.srcObject?.getAudioTracks().some(track=>track.readyState==='live')));
        await item.page.getByTitle('Device settings',{exact:true}).click();
        const settings=item.page.getByRole('dialog',{name:'Settings',exact:true});
        await settings.getByLabel(/Microphone/).selectOption({index:1});
        await settings.getByLabel(/Camera/).selectOption({index:1});
        await settings.getByRole('button',{name:/Apply/}).click();
        await settings.waitFor({state:'detached'});
        assert.deepEqual(item.errors,[]);
      }
      console.log('PASS: both RealtimeKit classrooms mute/unmute and apply camera/microphone selections without crashes');
      if(qaMode) {
        runRtk(`await client.stopRecording(${JSON.stringify(qaRecordingId)});`);
        for(let attempt=0;attempt<36;attempt++) {
          const status=JSON.parse(runRtk(`console.log(JSON.stringify((await client.recording(${JSON.stringify(qaRecordingId)})).status));`));
          if(status==='UPLOADED')break;
          assert(status!=='ERRORED','Cloudflare recording failed');
          if(attempt===35)throw new Error('Cloudflare recording upload timed out');
          await tutor.page.waitForTimeout(5000);
        }
        const result=JSON.parse(runRtk(`import {QaRecordingStorage} from './src/services/qaRecordingStorage'; const source=await client.recording(${JSON.stringify(qaRecordingId)}); const storage=new QaRecordingStorage(); const archived=await storage.archive(source.id,source.download_url,source.file_size); const prefix=Buffer.from(await new Response(storage.playback(source.id,archived.size,0,31)).arrayBuffer()); if(prefix.subarray(4,8).toString()!=='ftyp')throw new Error('Archived recording is not MP4'); console.log(JSON.stringify({size:archived.size,checksumVerified:!!archived.sha256,playbackVerified:true}));`));
        assert(result.size>1000);assert(result.checksumVerified && result.playbackVerified);
        console.log(`PASS: real Cloudflare recording stored encrypted in local Seaweed, checksummed and decrypted for playback (${result.size} bytes)`);
        await student.page.getByRole('button',{name:'Withdraw recording permission'}).click();
        await student.page.getByText('This lesson can continue without recording.',{exact:true}).waitFor();
      }
      await tutor.page.goto(new URL('/home',tutor.page.url()).href);
      await tutor.page.waitForFunction(()=>window.__pcs.every(pc=>pc.connectionState==='closed'));
      console.log('PASS: leaving the classroom closes RealtimeKit peer connections');
      runRtk(`await client.closeMeeting(${JSON.stringify(rtkFixture.meeting)});`);
      await student.page.waitForFunction(()=>window.__pcs.every(pc=>pc.connectionState==='closed'),{},{timeout:30000});
      console.log('PASS: server-controlled meeting closure disconnects the remaining student media');
      return;
    }
    for(const ws of peers.values())ws.send(packet('webrtc:peer-left',{}));
    for(const item of [tutor,student])await item.page.waitForFunction(()=>window.__pcs.some(pc=>pc.connectionState==='closed'));
    for(const item of [tutor,student]) {
      await item.page.waitForFunction(()=>window.__pcs.length>=2 && window.__pcs.at(-1).connectionState==='connected',{},{timeout:30000});
      await item.page.evaluate(()=>window.__pcs[0].onconnectionstatechange?.());
      await item.page.waitForTimeout(100);
      assert(['connected',null].includes(await item.page.evaluate(()=>document.querySelector('[data-call-state]')?.dataset.callState || null)));
      await item.page.locator('[data-call-state]').waitFor({state:'detached',timeout:10000});
    }
    console.log('PASS: reconnection works and closed peer events do not overwrite the current connected call');
    if(wrapUpMode) {
      overrideEndsAt = new Date(Date.now() - 175000).toISOString();
      broadcastState();
      for(const item of [tutor,student]) {
        await item.page.getByText(/Wrap-up.*Classroom closes in/).waitFor();
        assert(await item.page.getByRole('textbox',{name:'Chat message. Press Shift and Enter for a new line.'}).isEnabled());
        assert(await item.page.evaluate(()=>window.__pcs.at(-1).connectionState==='connected'));
        await item.page.screenshot({path:`../output/screenshots/classroom-wrap-up-${item===tutor?'tutor':'student'}.png`});
      }
      for(const item of [tutor,student]) {
        await item.page.getByText('Classroom closed. The three-minute wrap-up has ended.',{exact:true}).waitFor();
        assert(await item.page.getByRole('textbox',{name:'Chat message. Press Shift and Enter for a new line.'}).isDisabled());
        assert(await item.page.evaluate(()=>window.__pcs.every(pc=>pc.connectionState==='closed')));
        assert(await item.page.evaluate(()=>[...document.querySelectorAll('video')].every(video=>!video.srcObject || video.srcObject.getTracks().every(track=>track.readyState==='ended'))));
        assert.deepEqual(item.errors,[]);
      }
      console.log('PASS: both classrooms permit wrap-up then close peer connections, stop devices and disable chat at the three-minute limit');
      overrideEndsAt = undefined;
    }
    await tutor.context.close();
    await student.context.close();
    peers.clear();
    preparing = false;
    startsAt = new Date(Date.now() - 300000).toISOString();
    for(const role of ['tutor','student']) {
      const denied=await open(role,true);
      await denied.page.getByText('Failed to access camera or microphone',{exact:true}).waitFor();
      assert.equal(await denied.page.locator('[data-call-state]').getAttribute('role'),'alert');
      assert.equal(await denied.page.locator('[data-call-state] .spinner').count(),0);
      await denied.context.close();
      peers.clear();
    }
    console.log('PASS: both apps show permission errors instead of a stuck spinner');
  } finally {
    await browser.close();
    if(qaRecordingId)runRtk(`import {QaRecordingStorage} from './src/services/qaRecordingStorage'; await client.stopRecording(${JSON.stringify(qaRecordingId)}).catch(()=>{}); await new QaRecordingStorage().remove(${JSON.stringify(qaRecordingId)});`);
    if(rtkFixture)runRtk(`await client.closeMeeting(${JSON.stringify(rtkFixture.meeting)});`);
  }
})().catch(error=>{console.error(error);process.exitCode=1});
