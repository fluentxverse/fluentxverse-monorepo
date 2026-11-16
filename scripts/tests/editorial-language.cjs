const {chromium, expect} = require('@playwright/test');
const assert = require('node:assert/strict');
const {readFileSync,mkdirSync} = require('node:fs');
const {resolve} = require('node:path');
const root = resolve(__dirname,'../..');
const numbers = [1,2,3,4,6,7,8,9];
const slots = [...[3,4].flatMap(level=>[1,2,3,4,5].flatMap(chapter=>numbers.map(number=>[level,chapter,number]))),...numbers.map(number=>[5,1,number])];
const requested=process.argv.find(arg=>arg.startsWith('--slot='))?.slice(7);
const lessons = slots.filter(slot=>!requested||slot.join(':')===requested).map(slot=>JSON.parse(readFileSync(resolve(root,`output/toeic-language-revisions/${slot.join('-')}.json`),'utf8')));
assert(lessons.length>0,'Requested fixture slot is missing.');
const output=resolve(root,'output/toeic-language-revisions/screenshots');mkdirSync(output,{recursive:true});
const configs=[['student',390,'dark',lessons],['tutor',1440,'light',lessons],['dashboard',1440,'dark',lessons.filter(l=>[2,3,9].includes(l.lessonNumber))]];
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 let checks=0;
 try{
  for(const[role,width,theme,selected]of configs){
   const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,serviceWorkers:'block'});
   await context.addInitScript(({lessons,theme})=>{
    localStorage.setItem('csve-theme',theme);
    localStorage.setItem('theme-storage',JSON.stringify({state:{themeMode:theme,isDarkMode:theme==='dark'},version:2}));
    lessons.forEach(l=>sessionStorage.setItem(`preview-${l.id}`,JSON.stringify(l)));
   },{lessons,theme});
   let lesson;
   await context.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());
    if(req.method()!=='GET')return route.fulfill({status:403,json:{error:'Browser verification is read-only. No model or application writes.'}});
    if(!/^api\.fluentxverse\.(com|xyz)$/.test(url.hostname))return route.continue();
    if(/\.(png|webp|jpe?g|svg|woff2?)(?:$|\?)/i.test(url.pathname)||/^\/(files|uploads|assets|static)\//.test(url.pathname))return route.continue();
    const user={id:'editorial-'+role,userId:'editorial-'+role,role:role==='dashboard'?'superadmin':role,firstName:'Test',givenName:'Test'};
    const json={success:true,lesson,user,data:[],lessons:[]};
    if(url.pathname==='/proof/tutor-certification/me')json.data={snapshot:{writtenPassed:true,speakingPassed:true,profileApproved:true,interviewPassed:true,missingRequirements:[]}};
    if(url.pathname==='/notifications')json.data={notifications:[],unreadCount:0};
    return route.fulfill({json});
   });
   for(lesson of selected){
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const path=role==='dashboard'?'/conversational-skills-preview/':'/materials/conversational-skills/';
    await page.goto(`https://${role}.fluentxverse.com${path}${lesson.id}?theme=${theme}`,{waitUntil:'domcontentloaded'});
    const full=page.locator('.csp-fullpage'),mission=page.locator('.csp-mission-section').first();
    await expect(full).toContainText(lesson.lessonName);
    await expect(full).toContainText(lesson.goalTextJp);
    await expect(page.locator('.csp-apply-activity-title')).toHaveText(lesson.skill.toUpperCase());
    await expect(full).not.toContainText(/invented adult character|No personal or romantic|You may play/i);
    await expect(mission.locator('.csp-grammar-tip-items li')).toHaveCount(lesson.missionData.grammarTipItems.length);
    await expect(page.locator('.csp-mission-topic-card')).toHaveCount(3);
    if(lesson.level===4&&lesson.chapter===5&&lesson.lessonNumber===6){
     await expect(full).toContainText('is paid at the start, not every month.');
     await expect(full).toContainText('I will sign only if the terms');
    }
    if(lesson.skill==='speaking')await expect(page.locator('.csp-dialogue-line')).toHaveCount(10);
    else if(lesson.skill==='reading'){
     await expect(page.locator('.csp-reading-text-content')).toBeVisible();
     await expect(mission.locator('.csp-mission-reading-passage')).toContainText(lesson.missionData.readingPassage.title);
     assert(lesson.missionData.readingPassage.blocks[0].content!==lesson.applyData.readingText);
    }else{
     await expect(page.locator('.csp-dialogue-line')).toHaveCount(0);
     await expect(page.locator('.csp-listening-script-box')).toHaveCount(role==='student'?0:2);
    }
    if(role==='student')await expect(page.locator('.csp-guide-step:visible')).toHaveCount(0);
    else{
     await expect(page.locator('.csp-apply-layout .csp-guide-step')).toHaveCount(2);
     await expect(mission.locator('.csp-guide-step')).toHaveCount(lesson.skill==='speaking'?3:4);
     await expect(page.locator('.csp-feedback-layout .csp-guide-step')).toHaveCount(6);
    }
    const images=page.locator('.csp-intro-image img, .csp-apply-image img, .csp-mission-image img');
    if(lesson.level===3&&lesson.chapter===1&&lesson.lessonNumber<=2){
     await expect(images).toHaveCount(3);
     await expect.poll(()=>images.evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
    }else await expect(images).toHaveCount(0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow: ${lesson.id} ${role}`);
    assert.deepEqual(errors,[]);
    if([2,3,9].includes(lesson.lessonNumber)){
     await page.locator('.csp-apply-section').evaluate(el=>el.scrollIntoView({block:'start'}));
     await page.screenshot({path:resolve(output,`${lesson.level}-${lesson.chapter}-${lesson.lessonNumber}-${role}-${theme}.png`)});
    }
    await page.close();checks++;
    console.log(`PASS ${checks}: L${lesson.level} C${lesson.chapter} ${lesson.lessonNumber} ${role} ${width} ${theme}`);
   }
   await context.close();
  }
  console.log(JSON.stringify({checks,lessons:lessons.length,modelApiCalls:0}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
