export type SchedulePeriod = 'morning' | 'afternoon' | 'evening';

const manilaHourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  hourCycle: 'h23',
});

export const getSchedulePeriod = (timestamp: number): SchedulePeriod => {
  const hour = Number(manilaHourFormatter.format(new Date(timestamp)));
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
};
