import { expect, test } from 'bun:test';
import { notificationLink } from '../src/utils/notificationLink';

test('new and legacy booking notifications open the matching lesson', () => {
  for (const link of ['/schedule', '/lesson/old-lesson', undefined]) {
    expect(notificationLink({ type: 'booking_new', data: { bookingId: 'booked-lesson', link } })).toBe('/lesson/booked-lesson');
  }
  expect(notificationLink({ type: 'booking_new', data: { bookingId: 'id/with spaces' } })).toBe('/lesson/id%2Fwith%20spaces');
});

test('other notifications and bookings without an identifier preserve their links', () => {
  expect(notificationLink({ type: 'booking_cancelled', data: { bookingId: 'cancelled', link: '/schedule' } })).toBe('/schedule');
  expect(notificationLink({ type: 'booking_new', data: { link: '/schedule' } })).toBe('/schedule');
  expect(notificationLink({ type: 'system' })).toBeUndefined();
});
