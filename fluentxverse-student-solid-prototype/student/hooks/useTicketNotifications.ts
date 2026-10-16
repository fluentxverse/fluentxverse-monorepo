import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { getSocket, initSocket, connectSocket } from '../client/socket/socket.client';
import { useToastContext } from '../context/ToastContext';
import type { TicketReceivedData, TicketBalanceData } from '../types/socket.types';
/**
 * Hook to subscribe to ticket notifications via WebSocket
 * Shows toast notifications when tickets are received
 */
export const useTicketNotifications = (userId: Accessor<string | undefined>, onBalanceUpdate?: (balance: TicketBalanceData['balance']) => void) => {
    const _state0 = useToastContext();
    const handleTicketReceived = createMemo(on(() => [_state0.showSuccess], () => (data: TicketReceivedData) => {
        const tierLabel = data.tier.charAt(0).toUpperCase() + data.tier.slice(1);
        const message = `🎉 You received ${data.quantity} ${tierLabel} ticket${data.quantity > 1 ? 's' : ''}!`;
        // Show toast notification
        _state0.showSuccess(message, 5000);
    }));
    const handleBalanceUpdated = createMemo(on(() => [onBalanceUpdate], () => (data: TicketBalanceData) => {
        if (onBalanceUpdate) {
            onBalanceUpdate(data.balance);
        }
    }));
    createEffect(on(() => [userId(), handleTicketReceived(), handleBalanceUpdated()], () => {
        const _cleanup1 = untrack(() => {
            if (!userId())
                return;
            try {
                // Initialize socket if not already done
                initSocket();
                const socket = getSocket();
                // Connect if not connected
                connectSocket();
                // Subscribe to ticket notifications
                socket.emit('ticket:subscribe');
                // Listen for ticket events
                socket.on('ticket:received', handleTicketReceived());
                socket.on('ticket:balance-updated', handleBalanceUpdated());
                // Cleanup on unmount
                return () => {
                    socket.emit('ticket:unsubscribe');
                    socket.off('ticket:received', handleTicketReceived());
                    socket.off('ticket:balance-updated', handleBalanceUpdated());
                };
            }
            catch (error) {
                console.error('Error setting up ticket notifications:', error);
            }
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
};
export default useTicketNotifications;
