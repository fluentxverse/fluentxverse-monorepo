import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { io, type Socket } from 'socket.io-client';
import { studentEndpoints } from '../../config/productionDomains';
import { API_BASE_URL, getAuthToken } from '../../config/api';
const getSocketUrl = () => {
    return studentEndpoints(window.location.hostname, '', import.meta.env.VITE_STUDENT_SOCKET_URL).socketUrl;
};
const SOCKET_URL = getSocketUrl();
let socket: Socket | null = null;
export const getSocket = (): Socket => {
    if (!socket)
        throw new Error('Socket not initialized. Call initSocket() first.');
    return socket;
};
const resolveAuthToken = (token?: string) => {
    if (token)
        return token;
    const storedToken = getAuthToken();
    if (storedToken)
        return storedToken;
    const authCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('studentAuth=') || row.startsWith('auth='))
        ?.split('=')[1];
    return authCookie ? decodeURIComponent(authCookie) : undefined;
};
export const fetchSocketAuthToken = async (): Promise<string | undefined> => {
    const response = await fetch(`${API_BASE_URL}/student/socket-token`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-store' }
    });
    if (!response.ok)
        return undefined;
    const data = await response.json();
    return data?.success && data?.token ? data.token : undefined;
};
export const initSocket = (token?: string): Socket => {
    const resolvedToken = resolveAuthToken(token);
    if (socket) {
        socket.auth = resolvedToken ? { token: resolvedToken } : socket.auth;
        return socket;
    }
    socket = io(SOCKET_URL, {
        withCredentials: true,
        autoConnect: false,
        auth: async (callback) => {
            const socketToken = await fetchSocketAuthToken() || resolvedToken;
            callback(socketToken ? { token: socketToken } : {});
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        transports: ['websocket', 'polling']
    });
    return socket;
};
export const connectSocket = () => {
    const socket = getSocket();
    if (!socket.connected)
        socket.connect();
};
export const disconnectSocket = () => {
    if (socket)
        socket.disconnect();
};
export const destroySocket = () => {
    if (socket) {
        socket.disconnect();
        socket.removeAllListeners();
        socket = null;
    }
};
