import { ScheduleService } from './schedule.service';

const scheduleService = new ScheduleService();
let running = false;
let seeded = false;

export function startAttendanceJob(): void {
  const run = async () => {
    if (running) return;
    running = true;
    try {
      if (!seeded) {
        await scheduleService.enableAutoAttendanceForUpcomingBookings();
        await scheduleService.enableAutoAttendanceForUpcomingOpenSlots();
        await scheduleService.enableRoomEntryPolicyForUpcomingBookings();
        seeded = true;
      }
      const marked = await scheduleService.reconcileMissedTutorAttendance();
      if (marked) console.info(`Marked ${marked} unconfirmed booked lesson(s) absent with TA-301`);
      const unbooked = await scheduleService.reconcileMissedOpenSlotAttendance();
      if (unbooked) console.info(`Marked ${unbooked} unconfirmed open slot(s) absent with TA-302`);
      const roomMissed = await scheduleService.reconcileMissedTutorRoomEntry();
      if (roomMissed) console.info(`Marked ${roomMissed} booked lesson(s) absent after missing the classroom entry deadline`);
    } catch (error) {
      console.error('Automatic tutor attendance reconciliation failed:', error);
    } finally {
      running = false;
    }
  };

  void run();
  setInterval(() => void run(), 5_000);
}
