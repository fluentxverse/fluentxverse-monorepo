export const CLASSROOM_WRAP_UP_MS = 3 * 60_000;

export function canJoinClassroom(status: string, startsAt: number, endsAt: number, now = Date.now()) {
  return ['confirmed', 'completed'].includes(status) && Number.isFinite(startsAt) && Number.isFinite(endsAt)
    && now >= startsAt - 5 * 60_000 && now < endsAt + CLASSROOM_WRAP_UP_MS;
}
