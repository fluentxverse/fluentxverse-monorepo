import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { ssh, quote, sshOptions, cloudTarget } from './lib/cloud-ssh.mjs';
const root=process.cwd(),id='tutor-email-confirmation-20261026',release=join(root,'output/release',id);
const state=join(homedir(),'.local/state/fluentxverse',id),stage='/opt/fluentxverse/releases/'+id;
const composePath='/opt/fluentxverse/releases/20261023/compose.private.json';
const previousAPI='fluentxverse-cloud/api:payout-activation-20261025',image='fluentxverse-cloud/api:'+id;
const previousTutor='93f182f1-60d0-4ebd-9936-cbc5f944e630',tutor='fluentxverse-tutor-solid-prototype';
mkdirSync(release,{recursive:true});mkdirSync(state,{recursive:true,mode:0o700});
const run=(cmd,args,options={})=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:5*1024*1024,...options});
const save=(path,text)=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text);};
const copy=(from,to)=>{mkdirSync(dirname(to),{recursive:true});cpSync(from,to,{recursive:true});};
function replace(source,before,after,count=1){if(source.split(before).length!==count+1)throw Error('Release anchor changed: '+before.slice(0,90));return source.replaceAll(before,after);}
const secret=()=>{const p=parseEnv(readFileSync(join(root,'fluentxverse-server/.env'),'utf8')).TUTOR;if(!p||/[\r\n\0]/.test(p))throw Error('A valid TUTOR password is required in server .env');return p;};
async function verifyMailbox(){
  const code=`import{mailProvider}from'./src/services/mail/mailProvider';const password=(await Bun.stdin.json()).password;
  const address='tutor@fluentxverse.com',connection={host:'mail.spacemail.com',user:address,passwordEnv:'TUTOR'};
  try{await mailProvider.verify({id:'tutor',label:'Tutor Applications',address,shared:true,adminIds:[],imap:{...connection,port:993},smtp:{...connection,port:465,secure:true},imapPassword:password,smtpPassword:password});console.log(JSON.stringify({mailboxVerified:true}));process.exit(0);}catch{console.log(JSON.stringify({mailboxVerified:false}));process.exit(0);}`;
  const result=JSON.parse(ssh(`docker exec -i fluentxverse-server bun --no-env-file -e ${quote(code)}`,{input:JSON.stringify({password:secret()}),timeout:90000}));
  if(!result.mailboxVerified)throw Error('Tutor mailbox authentication failed. No production email gate has been enabled. Update TUTOR or review the provider.');
  return result;
}
const wrangler=(args,cwd)=>run('npx',['wrangler',...args,'--config','wrangler.jsonc'],{cwd,env:{...process.env,CI:'1'}});
const tutorVersion=()=>[...wrangler(['deployments','list'],join(root,tutor)).matchAll(/Version\(s\):\s+\(100%\)\s+([a-f0-9-]{36})/g)].at(-1)?.[1];
if(process.argv.includes('--verify-mail')){
  console.log(JSON.stringify(await verifyMailbox()));
}else if(process.argv.includes('--prepare')){
  if(existsSync(join(release,'manifest.json')))throw Error('Release already prepared');
  if(JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Config.Image}}'"))!==previousAPI)throw Error('API baseline changed');
  const api=join(release,'api'),live=path=>ssh('docker exec fluentxverse-server cat '+quote('/app/'+path));
  let code=live('src/routes/auth.route.ts');
  code=replace(code,"import { clearTutorSessionCookies, resolveTutorSession, setTutorSessionCookie } from '../utils/tutorSession';", "import { clearTutorSessionCookies, resolveTutorSession, setTutorSessionCookie } from '../utils/tutorSession';\nimport { createTutorEmailRoutes } from './tutorEmail.route';\nimport { tutorEmailService } from '../services/auth.services/tutorEmail.service';");
  code=replace(code,"const Auth = new Elysia({ name: 'auth', prefix: '/tutor' })","const Auth = new Elysia({ name: 'auth', prefix: '/tutor' })\n    .use(createTutorEmailRoutes())");
  code=replace(code,'        const responsePayload = {','        void tutorEmailService.send(userData.id).catch(() => {});\n        const responsePayload = {');
  code=replace(code,'          message: result.message,','          message: result.message,\n          emailConfirmationRequired: true,');
  save(join(api,'src/routes/auth.route.ts'),code);
  code=live('src/services/auth.services/tutor.service.ts');
  code=replace(code,'const { email, password, firstName, middleName, lastName, suffix, birthDate, mobileNumber } = params;',"const { password, firstName, middleName, lastName, suffix, birthDate, mobileNumber } = params;\n        const email = params.email.trim().toLowerCase();");
  code=replace(code,'MATCH (u:User { email: $email }) RETURN u LIMIT 1','MATCH (u:User) WHERE toLower(u.email) = $email RETURN u LIMIT 1');
  code=replace(code,'MATCH (s:Student { email: $email }) RETURN s LIMIT 1','MATCH (s:Student) WHERE toLower(s.email) = $email RETURN s LIMIT 1');
  code=replace(code,'MATCH (u:User { email: $email })\n','MATCH (u:User) WHERE toLower(u.email) = $email\n');
  code=replace(code,'{ email: params.email }','{ email: params.email.trim().toLowerCase() }');
  code=replace(code,'SET u.email = $newEmail, u.verifiedEmail = false',`SET u.email = $newEmail, u.verifiedEmail = false,
                    u.emailVerificationRevision=coalesce(u.emailVerificationRevision,0)+1,
                    u.emailAddressVersion=coalesce(u.emailAddressVersion,0)+1
                REMOVE u.verifiedEmailAddress,u.emailVerifiedAt`);
  save(join(api,'src/services/auth.services/tutor.service.ts'),code);
  code=live('src/services/exam.services/applicationPolicy.ts');
  code=replace(code,'import { getDriver } from "../../db/memgraph";', 'import { getDriver } from "../../db/memgraph";\nimport { tutorEmailVerified } from \'../auth.services/tutorEmailPolicy\';');
  code=replace(code,'  system = false,\n','  system = false,\n  requireVerifiedEmail = false,\n');
  code=replace(code,'  return u;\n',"  if (!system && requireVerifiedEmail && !tutorEmailVerified(u)) throw new ApplicationError(403, 'Confirm your email address before continuing your tutor assessment.');\n  return u;\n");
  code=replace(code,'const u = await lockApplicant(tx, tutorId);','const u = await lockApplicant(tx, tutorId, false, true);');
  const publish=code.indexOf('export async function publishGeneratedExam(');if(publish<0)throw Error('Missing exam publication boundary');
  code=code.slice(0,publish)+replace(code.slice(publish),'await lockApplicant(tx, tutorId);','await lockApplicant(tx, tutorId, false, true);');
  save(join(api,'src/services/exam.services/applicationPolicy.ts'),code);
  code=live('src/services/exam.services/exam.service.ts');code=replace(code,'      await lockApplicant(tx, tutorId);','      await lockApplicant(tx, tutorId, false, true);',2);save(join(api,'src/services/exam.services/exam.service.ts'),code);
  code=live('src/services/exam.services/speakingQueue.ts');code=replace(code,'await lockApplicant(tx, tutorId, system);','await lockApplicant(tx, tutorId, system, true);');save(join(api,'src/services/exam.services/speakingQueue.ts'),code);
  code=live('src/routes/exam.route.ts');code=replace(code,'import { getDriver } from "../db/memgraph";','import { getDriver } from "../db/memgraph";\nimport { tutorEmailVerified } from \'../services/auth.services/tutorEmailPolicy\';');
  code=replace(code,'throw new ApplicationError(403, "This account is suspended.");',`throw new ApplicationError(403, "This account is suspended.");
      if (!new URL(request.url).pathname.endsWith('/status') && !tutorEmailVerified(user)) throw new ApplicationError(403, 'Confirm your email address before continuing your tutor assessment.');`);save(join(api,'src/routes/exam.route.ts'),code);
  for(const path of ['src/routes/tutorEmail.route.ts','src/services/auth.services/tutorEmail.service.ts','src/services/auth.services/tutorEmailPolicy.ts','src/services/mail/mailConfig.ts','tests/tutorEmail.test.ts','tests/tutorEmail.persistence.ts','tests/mail.test.ts'])copy(join(root,'fluentxverse-server',path),join(api,path));
  code=live('src/index.ts');code=replace(code,"import Auth from './routes/auth.route';","import Auth from './routes/auth.route';\nimport { tutorEmailFailure } from './services/auth.services/tutorEmailPolicy';");
  code=replace(code,'    const requestId = (request as any).requestId;',`    const requestId = (request as any).requestId;
    if (path.startsWith('/tutor/email-verification')) { const f=tutorEmailFailure(error,String(code));set.status=f.status;set.headers['Cache-Control']='private, no-store';if(f.retryAfter)set.headers['Retry-After']=String(f.retryAfter);return f.body; }`);save(join(api,'src/index.ts'),code);
  code=ssh('docker exec fluentxverse-server cat /shared/requestDefense.ts');
  code=replace(code,"  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return general;", "  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return general;\n  if (/^\\/tutor\\/email-verification\\/(send|confirm)$/.test(path)) return { category: 'auth', maxBytes: 4096, accountLimit: 30, globalLimit: 300 };");save(join(api,'shared/requestDefense.ts'),code);
  save(join(api,'Dockerfile'),`FROM ${previousAPI}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup shared/ /shared/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\nRUN ["ln", "-s", "/app/src/services/mail/node_modules", "/app/tests/node_modules"]\n`);
  const prior=join(root,'output/release/tutor-about-matched-20261024/frontend'),frontend=join(release,'frontend');
  const liveHTML=await(await fetch('https://tutor.fluentxverse.com/')).text();
  if(liveHTML!==readFileSync(join(prior,tutor,'dist/index.html'),'utf8')||tutorVersion()!==previousTutor)throw Error('Tutor baseline changed');
  cpSync(prior,frontend,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
  for(const p of [frontend,join(frontend,tutor)])if(!existsSync(join(p,'node_modules')))symlinkSync(join(root,'node_modules'),join(p,'node_modules'));
  for(const p of ['tutor/pages/ConfirmEmailPage.tsx','tutor/pages/ConfirmEmailPage.css','tutor/Components/EmailVerifiedRoute.tsx','tutor/api/emailVerification.api.ts'])copy(join(root,tutor,p),join(frontend,tutor,p));
  const index=join(frontend,tutor,'tutor/index.tsx');code=readFileSync(index,'utf8');
  code=replace(code,"import { withProtected, withCertified } from './Components/ProtectedRoute';","import { withProtected, withCertified } from './Components/ProtectedRoute';\nimport { withVerifiedEmail } from './Components/EmailVerifiedRoute';");
  code=replace(code,"const RegisterPage = lazyRoute(() => import('./pages/RegisterPage'));","const RegisterPage = lazyRoute(() => import('./pages/RegisterPage'));\nconst ConfirmEmailPage = lazyRoute(() => import('./pages/ConfirmEmailPage'));");
  code=replace(code,'contact|register|privacy-policy','contact|register|confirm-email|privacy-policy');
  code=replace(code,'component={withProtected(HomeProtected)}','component={withVerifiedEmail(HomeProtected, true)}');
  code=replace(code,'<Route path="/register" component={RegisterPage}/>','<Route path="/register" component={RegisterPage}/>\n                    <Route path="/confirm-email" component={ConfirmEmailPage}/>');
  for(const p of ['ExamPage','SpeakingExamPage'])code=replace(code,`component={withProtected(${p})}`,`component={withVerifiedEmail(${p})}`);save(index,code);
  const registration=join(frontend,tutor,'tutor/pages/RegisterPage.tsx');code=readFileSync(registration,'utf8');code=replace(code,"window.location.replace('/home');","window.location.replace('/confirm-email');");code=replace(code,'Registration successful! Redirecting to login...','Registration successful! Confirm your email to continue.');save(registration,code);
  run('bun',['run','build'],{cwd:join(frontend,tutor),stdio:'inherit'});
  save(join(release,'manifest.json'),JSON.stringify({id,preparedAt:new Date().toISOString(),previousAPI,previousTutor,image,mailbox:'tutor@fluentxverse.com',activationRequiresSuccessfulMailboxAuthentication:true,scope:'Tutor email confirmation and shared admin mailbox; unrelated local edits excluded'},null,2));
  console.log('PASS scoped API/tutor release prepared; production unchanged');
}else if(process.argv.includes('--build')){
  rmSync(join(release,'images-built.json'),{force:true});
  run('tar',['-czf',join(release,'api.tar.gz'),'-C',join(release,'api'),'.']);ssh(`mkdir -p ${stage}/api`);
  run('scp',[...sshOptions,join(release,'api.tar.gz'),`${cloudTarget}:${stage}/api.tar.gz`]);ssh(`tar -xzf ${stage}/api.tar.gz -C ${stage}/api`);
  console.log(ssh(`docker build --pull=false --network=none -t ${image} ${stage}/api`,{timeout:180000}));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test ./tests/tutorEmail.test.ts ./tests/mail.test.ts`,{timeout:60000}));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/email-api.js`,{timeout:60000}));
  const imageId=JSON.parse(ssh(`docker image inspect ${image} --format '{{json .Id}}'`));
  save(join(release,'images-built.json'),JSON.stringify({image,imageId,builtAt:new Date().toISOString()}));
}else if(process.argv.includes('--activate')){
  const built=JSON.parse(readFileSync(join(release,'images-built.json')));
  if(built.imageId!==JSON.parse(ssh(`docker image inspect ${image} --format '{{json .Id}}'`)))throw Error('API image changed after testing');
  console.log(JSON.stringify(await verifyMailbox())); // Must pass before the first production change.
  if(tutorVersion()!==previousTutor)throw Error('Tutor release changed');
  const original=ssh(`cat ${composePath}`),compose=JSON.parse(original);
  if(compose.services.api.image!==previousAPI)throw Error('API release changed');
  const check="import{db,closePool}from'./src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classrooms; defer release');console.log(JSON.stringify({activeClassrooms:r[0].n}));}finally{await closePool();}";
  console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(check)}`));
  compose.services.api.image=image;compose.services.api.environment.TUTOR=secret().replaceAll('$','$$');compose.services.api.environment.TUTOR_PUBLIC_URL='https://tutor.fluentxverse.com';
  const next=join(state,'compose.private.json');writeFileSync(next,JSON.stringify(compose,null,2),{mode:0o600});
  const backup=composePath+'.pre-tutor-email-'+Date.now();ssh(`cp -p ${composePath} ${backup}`);
  run('scp',[...sshOptions,next,`${cloudTarget}:${composePath}.next`]);
  if(ssh(`cat ${composePath}`)!==original)throw Error('Runtime changed');
  let workerVersion='';
  try{
    ssh(`chmod 600 ${composePath}.next`);ssh(`mv ${composePath}.next ${composePath}`);
    console.log(ssh(`docker compose -f ${composePath} up -d --no-deps --wait --wait-timeout 120 api`,{timeout:180000}));
    const deployed=wrangler(['deploy'],join(release,'frontend',tutor));console.log(deployed);workerVersion=deployed.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1]||'';if(!workerVersion)throw Error('Confirm tutor Worker deployment');
    const r=await fetch('https://api.fluentxverse.com/tutor/email-verification/');if(r.status!==401)throw Error('Tutor email auth boundary failed');
    console.log(JSON.stringify(await verifyMailbox()));
  }catch(error){ssh(`cp -p ${backup} ${composePath}`);ssh(`docker compose -f ${composePath} up -d --no-deps --wait --wait-timeout 120 api`,{timeout:180000});if(workerVersion)wrangler(['rollback',previousTutor,'--yes'],join(release,'frontend',tutor));throw error;}
  save(join(release,'deployment.json'),JSON.stringify({deployedAt:new Date().toISOString(),image,workerVersion,previousAPI,previousTutor,mailboxVerified:true,sharedWithAllAdmins:true,previousCompose:backup},null,2));
  console.log('PASS tutor email confirmation and shared admin mailbox deployed');
}else throw Error('Use --verify-mail, --prepare, --build, or --activate');
