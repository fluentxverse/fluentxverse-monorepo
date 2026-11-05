const {chromium,expect}=require('@playwright/test');
const {readFileSync,mkdirSync}=require('node:fs');
const assert=require('node:assert/strict');
const source=readFileSync('/home/paulanthonyarriola/Desktop/budol/gmr-engine/internal/store/memgraph.go','utf8');
const abi=JSON.parse(source.match(/const erc1155EditionABI = `([\s\S]*?)`/)[1]);
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});mkdirSync('output/screenshots/erc1155-console',{recursive:true});
 try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:960}}),page=await context.newPage(),errors=[];let writes=0;
 page.on('pageerror',e=>errors.push(e.message));
 const project={id:'alpha',name:'FluentXVerse',environment:'development',status:'active',allowedChains:[42161],allowedContracts:[],rateLimitPerMinute:60};
 const account={id:'owner',name:'Operator',username:'operator',role:'admin',status:'active'};
 await page.route('**/dashboard/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;let body={};if(req.method()==='POST')writes++;
  if(path==='/dashboard/auth/me')body={account};
  else if(path==='/dashboard/projects')body={projects:[project]};
  else if(path==='/dashboard/projects/alpha')body={account,project,keys:[],usage:[],transactions:[],wallets:[],userWallets:[],erc20Deployments:[],erc1155EditionDeployments:[{id:'fxvid',name:'FXVID',symbol:'FXVID',status:'confirmed',chainId:42161,contractAddress:'0x25cbb57f2dccc478889a232a64fcee210fffd972',abi:JSON.stringify(abi),initialSupply:'0',initialTokenId:'0'}],escrowDeployments:[],marketplaceDeployments:[],privateClaimRegistryDeployments:[],shieldedPayoutPoolDeployments:[],shieldedWithdrawalVerifierDeployments:[],privacyAccessPassDeployments:[],lessonDisputeDeployments:[],importedContracts:[]};
  else if(path.endsWith('/notifications'))body={notifications:[]};
  return route.fulfill({json:body});
 });
 await page.goto('https://engine.fluentxverse.com/projects/alpha/contracts');
 await page.locator('.token-card').filter({hasText:'FXVID'}).click();const modal=page.getByRole('dialog');
 await expect(modal.getByRole('button',{name:'transfersEnabled',exact:true})).toBeVisible();
 await expect(modal.getByRole('button',{name:'transfersPermanentlyLocked',exact:true})).toBeVisible();
 await modal.getByRole('button',{name:'write',exact:true}).click();
 await modal.getByRole('button',{name:'setTransfersEnabled',exact:true}).click();
 await expect(modal.getByRole('heading',{name:'setTransfersEnabled',exact:true})).toBeVisible();
 await modal.getByRole('button',{name:'lockTransfersPermanently',exact:true}).click();
 await expect(modal.getByRole('heading',{name:'lockTransfersPermanently',exact:true})).toBeVisible();
 await page.screenshot({path:`output/screenshots/erc1155-console/${width}.png`,fullPage:true});
 assert.equal(writes,0,'No contract writes');assert.deepEqual(errors,[]);await context.close();console.log('PASS console '+width);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
