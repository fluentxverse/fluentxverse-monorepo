export function canCancelLesson(status: string, startsAt: number, now = Date.now()) {
  return status === 'confirmed' && Number.isFinite(startsAt) && now < startsAt - 5 * 60_000;
}
