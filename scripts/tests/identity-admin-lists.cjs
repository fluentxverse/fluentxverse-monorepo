const { chromium, expect } = require('@playwright/test');
const base = process.env.IDENTITY_ADMIN_URL || 'https://dashboard.fluentxverse.com';
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{for(const width of [1440,390]){
  const c=await b.newContext({viewport:{width,height:950}});
  await c.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin===base)return r.continue();
   const headers={'access-control-allow-origin':base,'access-control-allow-credentials':'true','access-control-allow-headers':'content-type,cache-control,pragma','access-control-allow-methods':'GET,POST,OPTIONS'};
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
   const tutor={id:'test',name:'Synthetic Tutor',email:'test@example.invalid',status:'pending',writtenExamPassed:true,speakingExamPassed:true,profileStatus:'incomplete',identityStatus:'pending_review',registeredAt:new Date().toISOString(),languages:['English'],rating:0};
   const j={success:true,data:[]};
   if(u.pathname==='/admin/me')j.user={userId:'reviewer',username:'Reviewer',role:'superadmin'};
   if(u.pathname==='/admin/tutors')j.data={tutors:[tutor],total:1};
   if(u.pathname==='/admin/applications')j.data={items:[{...tutor,status:'pending_interview',interviewResult:null}],counts:{total:1},total:1,page:1,pageSize:10,pageCount:1};
   return r.fulfill({headers,json:j});});
  const p=await c.newPage();await p.goto(base+'/tutors');
  await expect(p.getByRole('columnheader',{name:'Profile approval',exact:true})).toBeVisible();
  await expect(p.getByRole('columnheader',{name:'Identity verification',exact:true})).toBeVisible();
  await p.goto(base+'/applications');await expect(p.getByText('ID Review Pending',{exact:true})).toBeVisible();
  console.log('PASS admin lists '+width);await c.close();
 }}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
