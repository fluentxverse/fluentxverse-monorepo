import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import type { Socket } from 'socket.io-client';
import { CLASSROOM_WRAP_UP_MS } from '../utils/classroomWindow';
export function useClassroomStart(socket: Accessor<Socket | null>, sessionId: Accessor<string> = () => undefined) {
    const [schedule, setSchedule] = createSignal<{
        startsAt: number;
        endsAt: number;
        offset: number;
    } | null>(null);
    const [serverClosed, setServerClosed] = createSignal(false);
    const [now, setNow] = createSignal(Date.now());
    createEffect(on(() => [socket(), sessionId()], () => {
        const _cleanup0 = untrack(() => {
            setSchedule(null);
            setServerClosed(false);
            if (!socket() || !sessionId())
                return;
            const state = (data: {
                sessionId: string;
                startsAt?: string;
                endsAt?: string;
                serverNow?: string;
            }) => {
                if (data.sessionId !== sessionId() || !data.startsAt || !data.endsAt || !data.serverNow)
                    return;
                const startsAt = Date.parse(data.startsAt), endsAt = Date.parse(data.endsAt), serverNow = Date.parse(data.serverNow);
                if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || !Number.isFinite(serverNow))
                    return;
                setSchedule({ startsAt, endsAt, offset: serverNow - Date.now() });
                setNow(Date.now());
            };
            const disconnect = () => setSchedule(current => current && Date.now() + current.offset >= current.endsAt + CLASSROOM_WRAP_UP_MS ? current : null);
            const close = (data: {
                sessionId: string;
            }) => {
                if (data.sessionId === sessionId())
                    setServerClosed(true);
            };
            socket().on('session:state', state);
            socket().on('disconnect', disconnect);
            socket().on('session:classroom-closed', close);
            const timer = window.setInterval(() => setNow(Date.now()), 250);
            return () => { socket().off('session:state', state); socket().off('disconnect', disconnect); socket().off('session:classroom-closed', close); window.clearInterval(timer); };
        });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    const remaining = createMemo(() => schedule() ? Math.max(0, Math.ceil((schedule().startsAt - now() - schedule().offset) / 1000)) : null);
    const closed = createMemo(() => serverClosed() || Boolean(schedule() && now() + schedule().offset >= schedule().endsAt + CLASSROOM_WRAP_UP_MS));
    const wrapUp = createMemo(() => Boolean(schedule() && now() + schedule().offset >= schedule().endsAt && !closed()));
    const wrapSeconds = createMemo(() => schedule() ? Math.max(0, Math.ceil((schedule().endsAt + CLASSROOM_WRAP_UP_MS - now() - schedule().offset) / 1000)) : 0);
    return {
        get live() {
            return remaining() === 0 && !closed();
        },
        get closed() {
            return closed();
        },
        get wrapUp() {
            return wrapUp();
        },
        get wrapUpMessage() {
            return `Wrap-up · Classroom closes in ${Math.floor(wrapSeconds() / 60)}:${String(wrapSeconds() % 60).padStart(2, '0')}`;
        },
        get elapsed() {
            return schedule() ? Math.max(0, Math.floor((now() + schedule().offset - schedule().startsAt) / 1000)) : 0;
        },
        get message() {
            return closed() ? 'Classroom closed. The three-minute wrap-up has ended.' : remaining() === null ? 'Checking scheduled lesson time...'
                : `Lesson starts in ${Math.floor(remaining() / 60)}:${String(remaining() % 60).padStart(2, '0')} · Chat and call unavailable`;
        }
    };
}
