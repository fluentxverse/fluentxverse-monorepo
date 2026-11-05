import assert from 'node:assert/strict';
import { initDriver, getDriver, closeDriver } from './src/db/memgraph';
import { captureBooking, ensureRegistryOutbox, registryConfig, registryCommitment } from './src/services/lessonRegistry/outbox';

if (process.env.NODE_ENV !== 'production' || registryConfig()?.binding !== '42161:0x21e09faf72db719cbf9a801d8878a850823d10d1') throw Error('Pinned production registry required');
await initDriver(process.env.MEMGRAPH_URI!, process.env.MEMGRAPH_USER || '', process.env.MEMGRAPH_PASSWORD || '', 1);
const db = getDriver().session(), fixture = 'registry-batch-synthetic-20261104';
try {
  await ensureRegistryOutbox();
  const count = Number((await db.run('MATCH(b:LessonRegistrySmoke {batchFixture:$fixture}) RETURN count(b) AS n', { fixture })).records[0]!.get('n'));
  if (count !== 0 && count !== 8) throw Error('Partial synthetic fixture requires review');
  if (!count) await db.executeWrite(async tx => {
    for (let i = 0; i < 8; i++) {
      const id = fixture + ':' + i;
      await tx.run(`CREATE(:Booking {bookingId:$id,studentId:'synthetic-no-account',tutorId:'synthetic-no-account',
        status:'confirmed',slotId:'synthetic-no-slot',slotDateTime:datetime($at),durationMinutes:25,paymentMethod:'none',batchFixture:$fixture})`,
      { id, fixture, at: new Date().toISOString() });
      await captureBooking(tx, id, 'booking');
      // No real account/slot/payment exists; attendance jobs must never see the fixture.
      await tx.run('MATCH(b:Booking {bookingId:$id}) SET b:LessonRegistrySmoke REMOVE b:Booking', { id });
    }
  });
  const rows = (await db.run(`MATCH(b:LessonRegistrySmoke {batchFixture:$fixture})-[:HAS_REGISTRY_EVENT]->(e:LessonRegistryEvent)
    RETURN b,e ORDER BY e.sequence`, { fixture })).records;
  assert.equal(rows.length, 8);
  const events = rows.map(row => {
    const b = row.get('b').properties, e = row.get('e').properties, payload = JSON.parse(e.json);
    assert.equal(registryCommitment(registryConfig()!, b.registryKey, 1, 'FXV_BOOKING_RECEIPT_V1', e.artifact, e.salt), payload.commitment);
    return payload;
  });
  assert(events.every((e, i) => e.kind === 'booking' && e.bookingRevision === 1 && e.sequence === events[0].sequence + i));
  console.log(JSON.stringify({ synthetic: true, events, privateCommitmentsReproduced: true, realParticipants: 0, payments: 0 }));
} finally { await db.close(); await closeDriver(); }
