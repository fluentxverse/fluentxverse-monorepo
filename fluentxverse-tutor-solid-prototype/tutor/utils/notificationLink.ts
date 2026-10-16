import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "./cssStyle";
import type { Notification } from '../types/notification.types';
export function notificationLink(notification: Pick<Notification, 'type' | 'data'>) {
    if (notification.type === 'booking_new' && notification.data?.bookingId) {
        return `/lesson/${encodeURIComponent(notification.data.bookingId)}`;
    }
    return notification.data?.link;
}
