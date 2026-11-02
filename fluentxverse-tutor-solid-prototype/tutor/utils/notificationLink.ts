import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "./cssStyle";
import type { Notification } from '../types/notification.types';
export function notificationLink(notification: Pick<Notification, 'type' | 'data'>) {
    if (notification.data?.actionUnavailable) return undefined;
    if (notification.type === 'booking_new' && typeof notification.data?.bookingId === 'string' && notification.data.bookingId) {
        return `/lesson/${encodeURIComponent(notification.data.bookingId)}`;
    }
    const link = notification.data?.link;
    return typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') && !/[\\\s]/.test(link) ? link : undefined;
}
