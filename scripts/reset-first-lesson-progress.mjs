import {ssh,quote} from './lib/cloud-ssh.mjs';
const execute=process.argv.includes('--execute');
const code=`
import {initDriver,getDriver,closeDriver} from './src/db/memgraph';
import {tutorPerformanceService} from './src/services/tutorPerformance.service';
import {db,closePool} from './src/db/postgres';
await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);
const session=getDriver().session();
try{
 const email='paul.arriola@fluentxverse.com';
 const users=await session.run('MATCH(u:User) WHERE toLower(u.email)=$email RETURN u.id AS id',{email});
 if(users.records.length!==1)throw Error('Unique test tutor required');
 const id=users.records[0].get('id'),params={id};
 const before=await tutorPerformanceService.get(id,'all');
 const counts={};
 for(const label of ['Booking','TimeSlot','Penalty','LessonSurvey']){
  const result=await session.run('MATCH(n:'+label+' {tutorId:$id}) RETURN count(n) AS n',params);
  counts[label]=Number(result.records[0].get('n'));
 }
 const bookings=await session.run('MATCH(b:Booking {tutorId:$id}) RETURN b.bookingId AS id,b.status AS status,b.slotDateTime AS start',params);
 const future=bookings.records.filter(r=>!['cancelled','completed'].includes(r.get('status')) && (!Number.isFinite(Date.parse(r.get('start')))||Date.parse(r.get('start'))+30*60000>Date.now()));
 if(!${execute})console.log(JSON.stringify({id,counts,attended:before.lessons.attended,bookable:before.slots.bookable,activeOrFutureBookings:future.length}));
 else{
  if(future.length)throw Error('Active or future bookings exist; do not reset booked students');
  const active=await db.unsafe("SELECT count(*)::int AS n FROM session_participants WHERE user_id=$1 AND is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '60 seconds'",[id]);
  if(active[0].n)throw Error('Tutor has an active classroom; defer reset');
  await session.run('CREATE SNAPSHOT;');
  const tx=session.beginTransaction();
  const resetAt=new Date().toISOString(),resetId='first-lesson-test-'+Date.now();
  try{
   for(const label of ['Booking','TimeSlot','Penalty','LessonSurvey']){
    await tx.run('MATCH(n:'+label+' {tutorId:$id}) SET n:TestReset'+label+' SET n.testResetId=$resetId,n.testResetAt=$resetAt REMOVE n:'+label,{id,resetId,resetAt});
   }
   await tx.run('MATCH(u:User {id:$id}) SET u.lastFirstLessonTestReset=$resetAt',{id,resetAt});
   await tx.commit();
  }catch(error){await tx.rollback();throw error;}
  const after=await tutorPerformanceService.get(id,'all');
  if(after.lessons.attended!==0||after.slots.bookable!==0)throw Error('Reset verification failed');
  console.log(JSON.stringify({id,archived:counts,resetId,attended:after.lessons.attended,bookable:after.slots.bookable,accountPreserved:true,qualificationPreserved:true,financialRecordsUntouched:true,graphSnapshotCreated:true}));
 }
}finally{await session.close();await closeDriver();await closePool();}
`;
console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(code)));
