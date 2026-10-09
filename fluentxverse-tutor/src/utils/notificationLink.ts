import type { Notification } from '../types/notification.types';

export function notificationLink(notification: Pick<Notification, 'type' | 'data'>) {
  if (notification.type === 'booking_new' && notification.data?.bookingId) {
    return `/lesson/${encodeURIComponent(notification.data.bookingId)}`;
  }
  return notification.data?.link;
}
