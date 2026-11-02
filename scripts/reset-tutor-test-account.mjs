import { ssh, quote } from './lib/cloud-ssh.mjs';
const args = process.argv.slice(2);
const email = args[args.indexOf('--email') + 1];
const id = args[args.indexOf('--id') + 1];
if (!args.includes('--email') || !args.includes('--id') || !email?.includes('@') || !id) throw Error('Provide --email and --id; add --execute to delete the matched test account');
const execute = args.includes('--execute');
const code = `
import { initDriver, getDriver, closeDriver } from './src/db/memgraph';
import { db, closePool } from './src/db/postgres';
await initDriver(process.env.MEMGRAPH_URI, process.env.MEMGRAPH_USER, process.env.MEMGRAPH_PASSWORD, 1);
const s = getDriver().session(), id = ${JSON.stringify(id)}, email = ${JSON.stringify(email.toLowerCase())};
try {
  const matched = await s.run('MATCH(u:User {id:$id}) WHERE toLower(u.email)=$email RETURN u.id AS id', {id,email});
  const duplicates = await s.run('MATCH(u:User) WHERE toLower(u.email)=$email RETURN count(u) AS n', {email});
  if (matched.records.length !== 1 || Number(duplicates.records[0].get('n')) !== 1) throw Error('Exact, unique account match required');
  const bookings = await s.run('MATCH(b:Booking) WHERE b.tutorId=$id RETURN count(b) AS n', {id});
  if (Number(bookings.records[0].get('n'))) throw Error('Account has student bookings; do not delete without a separate retention review');
  const tables = await db.unsafe("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('user_id','tutor_id')");
  for (const row of tables) {
    if (!/^[a-z_]+$/.test(row.table_name) || !/^[a-z_]+$/.test(row.column_name)) throw Error('Unexpected schema identifier');
    const count = await db.unsafe('SELECT count(*)::int AS n FROM '+row.table_name+' WHERE '+row.column_name+'::text=$1', [id]);
    if (count[0].n) throw Error('Relational activity exists in '+row.table_name+'; retention review required');
  }
  if (!${execute}) { console.log(JSON.stringify({matched:true,noBookings:true,noRelationalActivity:true,execute:false})); }
  else {
    await s.run('CREATE SNAPSHOT;');
    const tx = s.beginTransaction();
    try {
      const other = await tx.run('MATCH(u:User {id:$id})-[]-(e:Exam)-[]-(other:User) WHERE other.id<>$id RETURN count(other) AS n', {id});
      if (Number(other.records[0].get('n'))) throw Error('Shared assessment ownership');
      await tx.run('MATCH(u:User {id:$id})-[]-(e:Exam)-[:HAS_RECORDING]->(r:SpeakingRecording) DETACH DELETE r', {id});
      await tx.run('MATCH(u:User {id:$id})-[]-(e:Exam) DETACH DELETE e', {id});
      await tx.run('MATCH(u:User {id:$id})-[]-(r:ApplicantSpeakingReset) DETACH DELETE r', {id});
      await tx.run('MATCH(n) WHERE (n.userId=$id OR n.tutorId=$id) AND (n:TimeSlot OR n:SpeakingRecording OR n:Notification OR n:TutorEmailVerification OR n:MobileSession) DETACH DELETE n', {id});
      await tx.run('MATCH(n:TutorEmailVerification) WHERE toLower(n.email)=$email DETACH DELETE n', {email});
      // Interview slots and administrative decisions remain as historical audit records.
      await tx.run('MATCH(u:User {id:$id}) WHERE toLower(u.email)=$email DETACH DELETE u', {id,email});
      await tx.commit();
    } catch (error) { await tx.rollback(); throw error; }
    const remaining = await s.run('MATCH(u:User) WHERE u.id=$id OR toLower(u.email)=$email RETURN count(u) AS n', {id,email});
    if (Number(remaining.records[0].get('n'))) throw Error('Account deletion verification failed');
    console.log(JSON.stringify({deleted:true,emailAvailableForRegistration:true,graphSnapshotCreated:true,administrativeHistoryRetained:true}));
  }
} finally { await s.close(); await closeDriver(); await closePool(); }
`;
console.log(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(code)}`));
