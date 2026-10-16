const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..'), base = process.env.STUDENT_TEST_URL || 'http://127.0.0.1:5176';
const contract = `0x${'1'.repeat(40)}`, batchId = `0x${'c'.repeat(64)}`, password = 'browser-test-only-passphrase';
const node = code => execFileSync('node',['--input-type=module','-e',code],{cwd:root,encoding:'utf8',timeout:30000}).trim();
const members = JSON.parse(node(`import {Identity} from '@semaphore-protocol/identity'; console.log(JSON.stringify(Array.from({length:7},(_,i)=>new Identity('pass-browser-test-only-'+i).commitment.toString())))`));
const artifacts = { wasmUrl:'/anonymous-reviews/semaphore.wasm',zkeyUrl:'/anonymous-reviews/semaphore.zkey',
  wasmSha256:'4edc07444a1d48d09014c963e315d3351b6e12838d83fcb1962071614b1c94b9',
  zkeySha256:'d02521afe7133a97421244374d4bc005c1ebd7d7cf7c51e88b7e99fdaf183146' };
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  await fs.mkdir(path.join(root,'output/screenshots'),{recursive:true});
  try {
    for(const theme of ['light','dark']) for(const width of [1440,375]) {
      const context=await browser.newContext({viewport:{width,height:width<600?812:1000}});
      await context.addInitScript(theme=>{if(/^https?:$/.test(location.protocol))localStorage.setItem('theme-storage',JSON.stringify({state:{isDarkMode:theme==='dark'},version:2}));},theme);
      const user={userId:'pass-browser-student',role:'student',givenName:'Mika',email:'passes@example.test'};
      const account={vault:null,orders:[],passes:[],reservations:[]};
      let batch, badPin=true, proofs=[], requests=[], modeFails=false, failOrder=true;
      await context.route(/^(http:\/\/(localhost|127\.0\.0\.1):(?:8765|8780)|https:\/\/api\.fluentxverse\.(?:com|xyz))\//,async route=>{
        const req=route.request(), url=new URL(req.url()), p=url.pathname; requests.push({path:p,body:req.postData()});
        const reply=data=>route.fulfill({json:{success:true,data}});
        if(p==='/student/me')return route.fulfill({json:{success:true,user}});
        if(p==='/lesson-passes/mode')return modeFails?route.fulfill({status:503,json:{success:false,error:'Approved ledger unavailable'}}):reply({mode:'private_passes',chainId:2651420,contract,artifacts:{...artifacts,wasmSha256:badPin?'0'.repeat(64):artifacts.wasmSha256}});
        if(p==='/lesson-passes/me')return reply(account);
        if(p==='/lesson-passes/vault') {
          const body=req.postDataJSON(); assert.equal(body.accountId,user.userId);assert.equal(body.version,account.vault?.version||0);
          assert.deepEqual(Object.keys(JSON.parse(body.envelope)).sort(),['ciphertext','iterations','iv','kdf','salt','version']);
          account.vault={version:body.version+1,envelope:body.envelope};return reply(account.vault);
        }
        if(p==='/lesson-passes/orders') {
          const order=req.postDataJSON();assert.equal(order.accountId,user.userId);assert(account.vault);assert.equal(order.commitments.length,1);
          if(!account.orders.length)account.orders.push({id:order.id,quantity:1,cents:600,status:'payment_pending'});
          else assert.equal(order.id,account.orders[0].id,'Unknown payment request retries the original order');
          if(failOrder){failOrder=false;return route.fulfill({status:503,json:{success:false,error:'Order confirmation interrupted'}});}
          return reply(account.orders[0]);
        }
        if(p===`/lesson-passes/batch/${batchId}`)return reply(batch);
        if(p==='/lesson-passes/reservations') {
          const body=req.postDataJSON();assert.equal(body.passId,account.passes[0].id);
          const reservation={...body,root:batch.root,deadline:Math.floor(Date.now()/1000)+172800,status:'prepared'};
          account.passes[0].status='authorizing';account.reservations=[reservation];return reply(reservation);
        }
        if(p.endsWith('/proof')) {
          const proof=req.postDataJSON();assert(!('privateKey'in proof));
          const valid=execFileSync('node',[path.join(root,'fluentxverse-server/src/services/anonymousReviews/verify.mjs')],{input:JSON.stringify(proof),encoding:'utf8',timeout:30000}).trim();
          assert.equal(valid,'true','Browser must generate a genuine Groth16 ownership proof');
          const auth=account.reservations[0];
          assert.equal(proof.message,node(`import {passMessage} from './fluentxverse-server/src/shared/lessonPasses.ts';console.log(passMessage(${JSON.stringify(auth)}))`));
          assert.equal(proof.scope,node(`import {passScope} from './fluentxverse-server/src/shared/lessonPasses.ts';console.log(passScope(2651420,${JSON.stringify(contract)}))`));
          proofs.push(proof);account.reservations[0].status='awaiting_horizen';return reply({status:'awaiting_horizen'});
        }
        if(p==='/tutor/search')return reply({tutors:[{userId:'pass-tutor',displayName:'Aya Nakamura',firstName:'Aya',lastName:'Nakamura',tier:1,isAvailable:true,isVerified:true,profilePicture:'/assets/img/banner/banner_woman.webp'}],total:1,hasMore:false});
        if(p.startsWith('/schedule/available/'))return reply([{slotId:'pass-slot',tutorId:'pass-tutor',date:url.searchParams.get('startDate'),time:'22:00',durationMinutes:25}]);
        if(p==='/schedule/reserve')return reply({reservationId:'pass-checkout-hold',expiresAt:new Date(Date.now()+120000).toISOString(),bookBy:new Date(Date.now()+120000).toISOString()});
        if(p==='/schedule/book') {
          const body=req.postDataJSON();assert.deepEqual(Object.keys(body).sort(),['privatePassReservationId','reservationId','slotId']);
          assert.equal(body.privatePassReservationId,account.reservations[0].id);account.reservations[0].bookingId='pass-booking';account.reservations[0].status='booked';return reply({bookingId:'pass-booking'});
        }
        return route.fulfill({json:{success:true,data:[],user,profile:{},notifications:[],lessons:[]}});
      });
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/tickets',{waitUntil:'domcontentloaded'});
      try { await page.getByRole('button',{name:'Create vault',exact:true}).waitFor(); }
      catch(e) { console.error({theme,width,errors,text:await page.locator('main').innerText().catch(()=>'' )}); await page.screenshot({path:path.join(root,'output/screenshots/lesson-passes-failure.png'),fullPage:true});throw e; }
      await page.getByLabel('Recovery passphrase',{exact:true}).fill(password);await page.getByLabel('Confirm passphrase',{exact:true}).fill(password);
      await page.getByRole('button',{name:'Create vault',exact:true}).click();await page.getByRole('status').filter({hasText:'Vault unlocked'}).waitFor();
      await page.getByRole('button',{name:'Request order',exact:true}).first().click();await page.getByRole('alert').filter({hasText:'interrupted'}).waitFor();
      // Reconcile an unknown response before offering another order.
      await page.reload({waitUntil:'domcontentloaded'});await page.getByLabel('Recovery passphrase',{exact:true}).fill(password);
      await page.getByRole('button',{name:'Unlock vault',exact:true}).click();await page.getByRole('status').filter({hasText:'Vault unlocked'}).waitFor();
      const vault=JSON.parse(execFileSync('bun',['-e',`const {decryptPassVault}=await import('./fluentxverse-student-solid-prototype/student/utils/lessonPassVault.ts'); const input=JSON.parse(await Bun.stdin.text());console.log(JSON.stringify(await decryptPassVault(input.envelope,input.password,input.student)));`],
        {cwd:root,input:JSON.stringify({envelope:account.vault.envelope,password,student:user.userId}),encoding:'utf8',timeout:30000}));
      const commitment=vault.notes[0].commitment, privateKey=vault.notes[0].privateKey;
      assert(!account.vault.envelope.includes(privateKey));
      const groupMembers=[commitment,...members].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1);
      const groupRoot=node(`import {Group} from '@semaphore-protocol/group';console.log(new Group(${JSON.stringify(groupMembers)}.map(BigInt)).root.toString())`);
      batch={id:batchId,root:groupRoot,members:groupMembers,status:'active'};
      account.orders[0].status='approved';account.passes=[{id:`${account.orders[0].id}:${commitment}`,commitment,batchId,status:'available',origin:'purchase'}];
      await page.getByRole('button',{name:'Refresh pass status',exact:true}).click();await page.getByRole('button',{name:'Prepare',exact:true}).waitFor();
      await page.getByRole('button',{name:'Prepare',exact:true}).click();await page.getByRole('alert').filter({hasText:'integrity check'}).waitFor();assert.equal(proofs.length,0);
      badPin=false;await page.reload({waitUntil:'domcontentloaded'});await page.getByLabel('Recovery passphrase',{exact:true}).fill(password);
      await page.getByRole('button',{name:'Unlock vault',exact:true}).click();await page.getByRole('status').filter({hasText:'Vault unlocked'}).waitFor();
      await page.getByRole('button',{name:'Prove ownership',exact:true}).click();await page.getByText('Horizen finality pending',{exact:true}).waitFor({timeout:120000});assert.equal(proofs.length,1);
      assert(requests.every(n=>!n.path.startsWith('/tickets/')),'Private mode must never request legacy tokens');
      assert(requests.every(n=>!n.body?.includes(privateKey)&&!n.body?.includes(password)),'Secrets and recovery passphrases never reach API');
      account.reservations[0].status='ready';account.passes=[];
      await page.getByRole('button',{name:'Refresh pass status',exact:true}).click();await page.getByRole('link',{name:'Book lesson',exact:true}).waitFor();
      await page.locator('.pass-package img').evaluateAll(images=>Promise.all(images.map(n=>n.decode())));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
      const heading=await page.locator('.pass-heading').boundingBox(),header=await page.locator('header.app-header-shell').boundingBox();assert(heading.y>=header.y+header.height,'Heading below fixed header');
      await page.screenshot({path:path.join(root,`output/screenshots/lesson-passes-${theme}-${width}.png`),fullPage:true});
      if(theme==='dark'&&width===375) {
        account.vault.version++;
        const writes=requests.filter(n=>n.path==='/lesson-passes/vault').length;
        await page.getByRole('button',{name:'Refresh pass status',exact:true}).click();
        await page.getByRole('button',{name:'Unlock vault',exact:true}).waitFor();
        assert(await page.getByRole('button',{name:'Request order',exact:true}).first().isDisabled(),'An externally updated vault locks stale local keys');
        assert.equal(requests.filter(n=>n.path==='/lesson-passes/vault').length,writes,'Refresh cannot overwrite another device vault');
        await page.getByLabel('Recovery passphrase',{exact:true}).fill(password);
        await page.getByRole('button',{name:'Unlock vault',exact:true}).click();await page.getByRole('status').filter({hasText:'Vault unlocked'}).waitFor();
      }
      if(theme==='light'&&width===1440) {
        await page.goto(base+'/browse-tutors',{waitUntil:'domcontentloaded'});await page.locator('.browse-tutor-card').first().waitFor();
        await page.getByRole('button',{name:/Tomorrow/}).click();
        await page.getByRole('button',{name:'Show schedule for Aya Nakamura',exact:true}).click();await page.locator('.booking-modal-time-slot').first().click();
        await page.getByRole('button',{name:'Confirm with lesson pass',exact:true}).click();await page.getByRole('heading',{name:'Booking Confirmed!',exact:true}).waitFor();
        assert.equal(requests.filter(n=>n.path==='/schedule/book').length,1);
        assert.equal(requests.filter(n=>n.path.startsWith('/tickets/')).length,0);
        modeFails=true;await page.goto(base+'/tickets',{waitUntil:'domcontentloaded'});await page.getByRole('alert').filter({hasText:'Approved ledger unavailable'}).waitFor();
        assert.equal(await page.locator('.package-card').count(),0,'No legacy fallback after mode failure');
      }
      assert.deepEqual(errors,[]);await context.close();console.log(`PASS private passes ${theme} ${width}: encrypted recovery, integrity pins, real worker proof, pending/finalized states and layout`);
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
