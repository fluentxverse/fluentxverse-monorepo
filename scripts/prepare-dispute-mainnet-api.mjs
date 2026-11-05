import {mkdirSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {root} from './identity-mainnet-operations.mjs';
const dir='output/release/dispute-mainnet-20261103',api=join(dir,'api'),remote='/opt/fluentxverse/releases/dispute-mainnet-20261103/api';
const files=['src/routes/studentDispute.route.ts','src/routes/disputeChain.route.ts',
 'src/services/studentDispute.service.ts','src/services/studentDispute.policy.ts','src/services/studentDispute.reminders.ts','src/services/disputeChain/outbox.ts',
 'src/services/lessonIssueImages.ts','src/services/studentLessonIssueReport.service.ts',
 'src/services/ticket.services/cancellationRefund.service.ts','src/utils/lessonReportingWindow.ts',
 'tests/studentDispute.test.ts','tests/requestDefense.test.ts'];
rmSync(api,{recursive:true,force:true});
for(const file of files){const p=join(api,file);mkdirSync(dirname(p),{recursive:true});cpSync(join('fluentxverse-server',file),p);}
const replace=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Missing/ambiguous production overlay: '+a);return s.replace(a,b);};
let index=readFileSync(join(dir,'live-api/src/index.ts'),'utf8');
index="import { disputeChainRoute } from './routes/disputeChain.route';\nimport { disputeFailure } from './services/studentDispute.policy';\n"+index;
index=replace(index,'.use(Inbox)','.use(Inbox)\n  .use(disputeChainRoute)');
index=replace(index,'    const requestId = (request as any).requestId;\n    if',"    const requestId = (request as any).requestId;\n    if(path.startsWith('/inbox/disputes/')) { const failure=disputeFailure(error,String(code));set.status=failure.status;set.headers['Cache-Control']='private, no-store';return failure.body; }\n    if");
writeFileSync(join(api,'src/index.ts'),index);
let inbox=readFileSync(join(dir,'live-api/src/routes/inbox.route.ts'),'utf8');
inbox="import StudentDisputes from './studentDispute.route';\n"+inbox;
inbox=replace(inbox,"const Inbox = new Elysia({ prefix: '/inbox' })","const Inbox = new Elysia({ prefix: '/inbox' })\n  .use(StudentDisputes)");
writeFileSync(join(api,'src/routes/inbox.route.ts'),inbox);
let attendance=readFileSync(join(dir,'live-api/src/services/schedule.services/attendance.job.ts'),'utf8');
attendance="import { studentDisputeService } from '../studentDispute.service';\nimport { dispatchDisputeReminders } from '../studentDispute.reminders';\n"+attendance;
attendance=replace(attendance,'export function startAttendanceJob(): void {',`export function startAttendanceJob(): void {\n  let disputeRunning=false;\n  const disputes=async()=>{if(disputeRunning)return;disputeRunning=true;try{await studentDisputeService.reconcile();await dispatchDisputeReminders();}catch{console.error('Dispute reconciliation will retry');}finally{disputeRunning=false;}};\n  void disputes();setInterval(()=>void disputes(),60000);`);
mkdirSync(join(api,'src/services/schedule.services'),{recursive:true});writeFileSync(join(api,'src/services/schedule.services/attendance.job.ts'),attendance);
let workflow=readFileSync(join(dir,'live-api/src/services/lessonWorkflow.service.ts'),'utf8');
workflow=replace(workflow,"MATCH (b:Booking {bookingId: $id}) WHERE b.status IN ['confirmed', 'completed']","MATCH (b:Booking {bookingId: $id}) WHERE b.status IN ['confirmed', 'completed'] AND coalesce(b.disputeHold,false)=false");
writeFileSync(join(api,'src/services/lessonWorkflow.service.ts'),workflow);
let earnings=readFileSync(join(dir,'live-api/src/services/admin.services/tutorEarnings.service.ts'),'utf8');
const current=readFileSync('fluentxverse-server/src/services/admin.services/tutorEarnings.service.ts','utf8'),start='export function payableCompletion(',end='export interface PayoutReservationInput';
earnings=earnings.slice(0,earnings.indexOf(start))+current.slice(current.indexOf(start),current.indexOf(end))+earnings.slice(earnings.indexOf(end));
mkdirSync(join(api,'src/services/admin.services'),{recursive:true});writeFileSync(join(api,'src/services/admin.services/tutorEarnings.service.ts'),earnings);
mkdirSync(join(api,'shared'),{recursive:true});cpSync('shared/disputeChainPolicy.json',join(api,'shared/disputeChainPolicy.json'));
const image='fluentxverse-cloud/api:dispute-mainnet-20261103';
writeFileSync(join(api,'Dockerfile'),`FROM fluentxverse-cloud/api:profile-review-consistency-20261103\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\nCOPY --chown=appuser:appgroup shared/ /shared/\n`);
root(`mkdir -p ${remote} && tar -xzf - -C ${remote}`,{input:execFileSync('tar',['-czf','-','-C',api,'.'])});
console.log(root(`docker build --network none -t ${image} ${remote}`));
console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/dispute-mainnet.js`));
console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/studentDispute.test.ts tests/requestDefense.test.ts tests/identityProduction.test.ts tests/profileReview.test.ts`));
writeFileSync(join(dir,'api-prepared.json'),JSON.stringify({image,baseline:'fluentxverse-cloud/api:profile-review-consistency-20261103',scopedFiles:files,holdsEnabled:true}));
