const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const base=process.env.PROFILE_COLUMNS_URL||'http://127.0.0.1:5197';
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const out=require('node:path').resolve(__dirname,'../../output/screenshots/application-profile-columns');await fs.mkdir(out,{recursive:true});
 try{for(const width of [1566,1440,1280,1024,390,320]){
  const c=await b.newContext({viewport:{width,height:950}});
  await c.route('**/*',async r=>{
   const u=new URL(r.request().url());if(u.origin===base)return r.continue();
   const headers={'access-control-allow-origin':base,'access-control-allow-credentials':'true','access-control-allow-headers':'content-type,cache-control,pragma','access-control-allow-methods':'GET,POST,OPTIONS'};
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
   const j={success:true,data:[]};
   if(u.pathname==='/admin/me')j.user={userId:'reviewer',username:'Reviewer',role:'superadmin'};
   if(u.pathname==='/admin/applications')j.data={items:['incomplete','pending_review','approved','rejected'].map((profileStatus,i)=>({id:'test-'+i,name:'Synthetic Applicant '+i,email:'test-'+i+'@example.invalid',status:'pending_interview',writtenExamPassed:true,speakingExamPassed:true,interviewResult:null,profileStatus,identityStatus:['not_submitted','pending_review','accepted','verified'][i]})),counts:{total:4},total:4,page:1,pageSize:10,pageCount:1};
   return r.fulfill({headers,json:j});
  });
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/applications');await expect(p.locator('.application-card')).toHaveCount(4);
  await expect(p.locator('.application-card').first()).toHaveCSS('display','grid');
  if(width<=1200)await expect(p.locator('.application-column-headings')).toBeHidden();
  const expected=[['Not submitted','Not started'],['Submitted','Pending review'],['Submitted','Approved'],['Submitted','Rejected']];
  for(let i=0;i<4;i++){
   const row=p.locator('.application-card').nth(i);
   await expect(row.locator('[data-profile-column=submission] dd')).toHaveText(expected[i][0]);
   await expect(row.locator('[data-profile-column=review] dd')).toHaveText(expected[i][1]);
   assert.deepEqual(await row.locator('.exam-step .step-label').allTextContents(),['Written','Speaking','ID Submission','Interview']);
   const labels=await row.locator('.step-label').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,height:r.height,width:r.width,scrollWidth:e.scrollWidth};}));
   assert.ok(labels.every(r=>Math.abs(r.top-labels[0].top)<1&&r.height===15&&r.scrollWidth<=r.width+1),'single-line label alignment '+width);
   await expect(row.getByRole('link',{name:'Schedule Interview',exact:true})).toHaveCount(i===2?1:0);
   if(i===1)await expect(row.getByRole('link',{name:'Review ID',exact:true})).toBeVisible();
  }
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'horizontal overflow '+width);
  const overlap=await p.locator('.application-card').evaluateAll(rows=>rows.some(row=>{const rects=[...row.children].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height);return rects.some((a,i)=>rects.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));}));
  assert.equal(overlap,false,'overlapping columns '+width);assert.deepEqual(errors,[]);
  const alignment=await p.evaluate(()=>{
   const heading=document.querySelector('.application-column-headings');
   if(!heading||getComputedStyle(heading).display==='none')return true;
   const starts=[...heading.children].map(e=>e.getBoundingClientRect().left);
   const stepHeading=heading.children[1];
   if(getComputedStyle(stepHeading).textAlign!=='center')return false;
   const headingRect=stepHeading.getBoundingClientRect();
   const rows=[...document.querySelectorAll('.application-card')];
   const icons=rows[0].querySelectorAll('.step-icon');
   return rows.every(row=>{const steps=row.querySelector('.exam-progress').getBoundingClientRect();return Math.abs((steps.left+steps.right)-(headingRect.left+headingRect.right))<1&&[...row.children].every((e,i)=>Math.abs(e.getBoundingClientRect().left-starts[i])<1)
     &&[...row.querySelectorAll('.step-icon')].every((e,i)=>Math.abs(e.getBoundingClientRect().left-icons[i].getBoundingClientRect().left)<1);});
  });
  assert.equal(alignment,true,'header/row/step alignment '+width);
  await p.screenshot({path:out+'/'+width+'.png',fullPage:true});await c.close();console.log('PASS profile columns '+width);
 }}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
