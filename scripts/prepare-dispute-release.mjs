import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../',import.meta.url));
const release = path.join(root,'output/release/lesson-dispute-20261018');
const frontends = path.join(release,'frontends'), api = path.join(release,'api');
const baseCommit = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const live = JSON.parse(execFileSync('docker',['inspect','fluentxverse-server'],{encoding:'utf8'}))[0];
if (live.Config.Image !== 'fluentxverse-server:profile-optimization-20261017') throw new Error('Unexpected live API image; review the release base first.');
mkdirSync(frontends,{recursive:true});mkdirSync(api,{recursive:true});
const archive = execFileSync('git',['archive','--format=tar',baseCommit],{cwd:root,maxBuffer:512*1024*1024});
execFileSync('tar',['-x','-C',frontends],{input:archive,maxBuffer:1024*1024});
const manifest={baseCommit,baseImage:live.Config.Image,createdAt:new Date().toISOString(),files:{}};
function copy(relative,destination=frontends) {
  const target=path.join(destination,relative);mkdirSync(path.dirname(target),{recursive:true});
  copyFileSync(path.join(root,relative),target);
  manifest.files[relative]=createHash('sha256').update(readFileSync(target)).digest('hex');
}
function patch(file,transform) {
  const before=readFileSync(file,'utf8'),after=transform(before);
  if(before===after)throw new Error(`No release overlay applied: ${file}`);
  const diff=`*** Begin Patch\n*** Update File: ${file}\n@@\n${before.trimEnd().split('\n').map(line=>'-'+line).join('\n')}\n${after.trimEnd().split('\n').map(line=>'+'+line).join('\n')}\n*** End Patch`;
  execFileSync('apply_patch',[diff],{cwd:root,stdio:['ignore','pipe','pipe']});
}
function replaceOnce(source,from,to) {
  if(source.split(from).length!==2)throw new Error(`Release anchor is missing or ambiguous: ${from.slice(0,80)}`);
  return source.replace(from,to);
}
for (const relative of ['shared/lessonPrivacy.ts','shared/lessonPrivacyApi.ts','shared/ui/LessonEvidence.tsx','shared/ui/lesson-privacy.css',
  'fluentxverse-student-solid-prototype/student/api/lessonPrivacy.api.ts','fluentxverse-tutor-solid-prototype/tutor/api/lessonPrivacy.api.ts',
  'fluentxverse-dashboard/src/components/PrivateDisputeEvidence.tsx','fluentxverse-dashboard/src/components/PrivateDisputeEvidence.css',
  'fluentxverse-dashboard/src/pages/LessonOperationsPage.tsx'])copy(relative);
for (const app of ['student','tutor']) {
  const appRoot=path.join(frontends,`fluentxverse-${app}-solid-prototype`);
  if(!existsSync(path.join(appRoot,'node_modules')))symlinkSync(path.join(root,`fluentxverse-${app}-solid-prototype/node_modules`),path.join(appRoot,'node_modules'),'dir');
  patch(path.join(appRoot,'vite.config.ts'),s=>replaceOnce(s,'resolve: { alias:','resolve: { dedupe: [\'solid-js\', \'@solidjs/router\', \'lucide-solid\'], alias:'));
  patch(path.join(appRoot,'tsconfig.json'),s=>{
    const config=JSON.parse(s);config.compilerOptions.paths={...config.compilerOptions.paths,
      'solid-js':['./node_modules/solid-js'],'solid-js/*':['./node_modules/solid-js/*'],
      '@solidjs/router':['./node_modules/@solidjs/router'],'lucide-solid':['./node_modules/lucide-solid']};
    return JSON.stringify(config,null,2)+'\n';
  });
}
for (const [dir,target] of [['node_modules',path.join(root,'node_modules')],['fluentxverse-dashboard/node_modules',path.join(root,'fluentxverse-dashboard/node_modules')]])
  if(!existsSync(path.join(frontends,dir)))symlinkSync(target,path.join(frontends,dir),'dir');
patch(path.join(frontends,'fluentxverse-student-solid-prototype/student/pages/LessonPage.tsx'),s=>{
  s=replaceOnce(s,"import StudentLessonIssueReport from '../Components/StudentLessonIssueReport';","import StudentLessonIssueReport from '../Components/StudentLessonIssueReport';\nimport LessonEvidence from '../../../shared/ui/LessonEvidence';\nimport { lessonPrivacyApi } from '../api/lessonPrivacy.api';");
  return replaceOnce(s,'              <StudentLessonRecap bookingId={bookingId()!}/>','              <StudentLessonRecap bookingId={bookingId()!}/>\n              <LessonEvidence bookingId={bookingId()!} role="student" api={lessonPrivacyApi}/>');
});
patch(path.join(frontends,'fluentxverse-student-solid-prototype/student/Components/StudentLessonIssueReport.tsx'),s=>replaceOnce(s,
  '            setStatus(current => current && ({ ...current, report, eligible: false }));',
  "            setStatus(current => current && ({ ...current, report, eligible: false }));\n            window.dispatchEvent(new Event('lesson-issue-updated'));"));
patch(path.join(frontends,'fluentxverse-tutor-solid-prototype/tutor/pages/StudentProfilePage.tsx'),s=>{
  s=replaceOnce(s,"import LessonMaterialRequest from '../Components/LessonMaterialRequest';","import LessonMaterialRequest from '../Components/LessonMaterialRequest';\nimport LessonEvidence from '../../../shared/ui/LessonEvidence';\nimport { lessonPrivacyApi } from '../api/lessonPrivacy.api';");
  s=replaceOnce(s,'          {lessonData() && <LessonNotesCard sessionId={lessonData().sessionId || bookingId()!}/>}',
    '          {lessonData() && <LessonNotesCard sessionId={lessonData().sessionId || bookingId()!}/>}\n          {lessonData() && <LessonEvidence bookingId={bookingId()!} role="tutor" api={lessonPrivacyApi}/>}');
  return replaceOnce(s,'            setReportStatus(current => current ? { ...current, report: result.data } : current);',
    "            setReportStatus(current => current ? { ...current, report: result.data } : current);\n            window.dispatchEvent(new Event('lesson-issue-updated'));");
});
mkdirSync(path.join(api,'src'),{recursive:true});
execFileSync('docker',['cp','fluentxverse-server:/app/src/index.ts',path.join(api,'src/index.ts')]);
patch(path.join(api,'src/index.ts'),s=>{
  s=replaceOnce(s,"import LessonWorkflow from './routes/lessonWorkflow.route';","import LessonWorkflow from './routes/lessonWorkflow.route';\nimport LessonPrivacy, { lessonPrivacyFailure } from './routes/lessonPrivacy.route';\nimport { startLessonEvidenceRetention } from './services/lessonPrivacy/retention';");
  s=replaceOnce(s,'  .use(LessonWorkflow)','  .use(LessonWorkflow)\n  .use(LessonPrivacy)');
  s=replaceOnce(s,"path.startsWith('/lesson-passes/')) return;","path.startsWith('/lesson-passes/') || path.startsWith('/lesson-privacy/')) return;");
  s=replaceOnce(s,'    const requestId = (request as any).requestId;',`    const requestId = (request as any).requestId;
    if (path.startsWith('/lesson-privacy/')) {
      const response = lessonPrivacyFailure(error,String(code));
      set.status = response.status;
      set.headers['Cache-Control'] = 'no-store';
      return response.body;
    }`);
  return replaceOnce(s,'  startQaRecordingJobs();','  startQaRecordingJobs();\n  startLessonEvidenceRetention();');
});
for (const relative of ['src/routes/lessonPrivacy.route.ts','src/services/lessonPrivacy/crypto.ts','src/services/lessonPrivacy/policy.ts',
  'src/services/lessonPrivacy/service.ts','src/services/lessonPrivacy/store.ts','src/services/lessonPrivacy/retention.ts']) {
  const target=path.join(api,relative);mkdirSync(path.dirname(target),{recursive:true});
  copyFileSync(path.join(root,'fluentxverse-server',relative),target);
  manifest.files[`fluentxverse-server/${relative}`]=createHash('sha256').update(readFileSync(target)).digest('hex');
}
copy('shared/lessonPrivacy.ts',api);
writeFileSync(path.join(api,'Dockerfile'),`FROM ${live.Config.Image}
COPY --chown=appuser:appgroup src/index.ts /app/src/index.ts
COPY --chown=appuser:appgroup src/routes/lessonPrivacy.route.ts /app/src/routes/lessonPrivacy.route.ts
COPY --chown=appuser:appgroup src/services/lessonPrivacy /app/src/services/lessonPrivacy
COPY --chown=appuser:appgroup shared/lessonPrivacy.ts /shared/lessonPrivacy.ts
`);
writeFileSync(path.join(release,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Prepared feature-only frontend and API overlays:',release);
