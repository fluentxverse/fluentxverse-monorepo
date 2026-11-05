import{execFileSync,spawn}from'node:child_process';
import{cpSync,mkdirSync,existsSync,symlinkSync,realpathSync,readFileSync,writeFileSync}from'node:fs';
import{join,dirname}from'node:path';
const root=process.cwd(),release=join(root,'output/release/interview-join-ui-current-20261102');
const apps=[{name:'dashboard',dir:'fluentxverse-dashboard',base:'identity-review-workspace-final-20261102',source:'/tmp/fxv-mit-export-20261102/fluentxverse-dashboard',previous:'2876a345-61c6-4480-99cb-63cb081bacde',files:['src/pages/InterviewRoomPage.tsx','src/pages/InterviewRoomPage.css'],port:5197},{name:'tutor',dir:'fluentxverse-tutor-solid-prototype',base:'tutor-identity-design-20261102',previous:'d392ade3-169a-4fdc-bb11-13f79fbd550d',files:['tutor/pages/InterviewRoomPage.tsx'],port:5199}];
const cwd=a=>join(release,a.name,'frontend',a.dir);
const run=(a,cmd,args,extra={})=>execFileSync(cmd,args,{cwd:cwd(a),encoding:'utf8',env:{...process.env,CI:'1'},maxBuffer:8e6,...extra});
const wrangler=(a,args)=>run(a,'bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
if(process.argv.includes('--prepare'))for(const a of apps){
 const base=a.source || join(root,'output/release',a.base,'frontend'),front=join(release,a.name,'frontend');
 if(!existsSync(cwd(a)))cpSync(base,front,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd(a),'node_modules')))symlinkSync(realpathSync(join(base,a.dir,'node_modules')),join(cwd(a),'node_modules'),'dir');
 for(const f of a.files){const p=join(cwd(a),f);mkdirSync(dirname(p),{recursive:true});cpSync(join(root,a.dir,f),p);}console.log(a.name,run(a,'bun',['run','build']));
}else if(process.argv.includes('--verify')){
 const children=apps.map(a=>spawn('bunx',['vite','preview','--host','127.0.0.1','--port',String(a.port),'--strictPort'],{cwd:cwd(a),stdio:'ignore',detached:true}));
 try{for(const a of apps){let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:'+a.port)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}if(!ready)throw Error('Preview failed '+a.name);}
 console.log(execFileSync('node',['scripts/test-interview-chat.cjs'],{cwd:root,encoding:'utf8',env:{...process.env,INTERVIEW_DENIAL_TEST:'true',INTERVIEW_DASHBOARD_URL:'http://127.0.0.1:5197',INTERVIEW_TUTOR_URL:'http://127.0.0.1:5199'},maxBuffer:8e6}));writeFileSync(join(release,'verification.json'),JSON.stringify({passed:true}));
 }finally{for(const child of children)try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--deploy')){
 if(!JSON.parse(readFileSync(join(release,'verification.json'))).passed)throw Error('Verify first');
 for(const a of apps){const v=JSON.parse(wrangler(a,['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;if(v.length!==1||v[0].version_id!==a.previous)throw Error('Baseline changed '+a.name);}
 for(const a of apps){const output=wrangler(a,['deploy']);console.log(output);writeFileSync(join(release,a.name,'deployment.json'),JSON.stringify({previous:a.previous,output}));}
}else throw Error('Use --prepare, --verify, --deploy');
