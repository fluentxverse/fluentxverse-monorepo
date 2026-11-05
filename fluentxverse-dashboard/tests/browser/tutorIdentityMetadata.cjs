const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const base=process.env.IDENTITY_DASHBOARD_URL||'http://127.0.0.1:5304';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  let credentials=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.routeWebSocket('**/*',ws=>ws.close());
  await context.route('**/*',route=>{
   const url=new URL(route.request().url()),path=url.pathname;
   if(url.origin===base)return route.continue();
   let json={success:true,data:[]};
   if(path==='/admin/me')json={success:true,user:{userId:'reviewer',username:'Reviewer',role:'superadmin'}};
   if(path.endsWith('/access'))json.data={permissions:['operations','support']};
   if(path.includes('/people/tutor/'))json.data={person:{name:'Test Tutor',email:'test@example.com'},lessons:[],penalties:[],reports:[],transactions:[],identityCredentials:credentials};
   return route.fulfill({json});
  });
  await page.goto(base+'/operations/people/tutor/fixture');
  await expect(page.getByRole('heading',{name:'ID credential NFT'})).toBeVisible();
  await expect(page.getByText('No identity credential has been requested for this tutor.')).toBeVisible();
  credentials=[{submissionId:'new',current:true,status:'credential_awaiting_arbitrum_finality'},
   {submissionId:'old',current:false,revoked:true,issuerStatus:'invalidated',chainId:42161,wallet:'0x'+'1'.repeat(40),collection:'0x'+'2'.repeat(40),tokenId:'1234567890'.repeat(7),
    metadataUrl:'https://api.fluentxverse.com/proof/tutor-identity/metadata/fixture.json',mintTransactionHash:'0x'+'3'.repeat(64),proofTransactionHash:'0x'+'4'.repeat(64)}];
  await page.getByRole('button',{name:'Refresh account',exact:true}).click();
  await expect(page.getByText('Current credential',{exact:true})).toBeVisible();
  await expect(page.getByText('awaiting arbitrum finality',{exact:true})).toBeVisible();
  await expect(page.getByText('This NFT remains on-chain, but its approval is no longer valid.')).toBeVisible();
  const metadata=page.getByRole('link',{name:'View NFT metadata'});
  await expect(metadata).toHaveAttribute('href',credentials[1].metadataUrl);
  await expect(metadata).toHaveAttribute('target','_blank');
  await expect(page.getByRole('link',{name:'Mint transaction'})).toHaveAttribute('href','https://arbiscan.io/tx/'+credentials[1].mintTransactionHash);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflows horizontally');
  await page.screenshot({path:`/tmp/tutor-id-metadata-${width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}: empty, pending, invalidated NFT metadata and transaction links; no overflow`);
  await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
