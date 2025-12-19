import { useEffect, useCallback } from 'preact/hooks';
import { getSocket, initSocket, connectSocket } from '../client/socket/socket.client';
import { useToastContext } from '../context/ToastContext';
import type { TicketReceivedData, TicketBalanceData } from '../types/socket.types';

/**
 * Hook to subscribe to ticket notifications via WebSocket
 * Shows toast notifications when tickets are received
 */
export const useTicketNotifications = (
  userId: string | undefined,
  onBalanceUpdate?: (balance: TicketBalanceData['balance']) => void
) => {
  const { showSuccess } = useToastContext();

  const handleTicketReceived = useCallback((data: TicketReceivedData) => {
    console.log('🎫 Ticket received notification:', data);
    
    const tierLabel = data.tier.charAt(0).toUpperCase() + data.tier.slice(1);
    const message = `🎉 You received ${data.quantity} ${tierLabel} ticket${data.quantity > 1 ? 's' : ''}!`;
    
    // Show toast notification
    showSuccess(message, 5000);
  }, [showSuccess]);

  const handleBalanceUpdated = useCallback((data: TicketBalanceData) => {
    console.log('🎫 Balance updated notification:', data);
    
    if (onBalanceUpdate) {
      onBalanceUpdate(data.balance);
    }
  }, [onBalanceUpdate]);

  useEffect(() => {
    if (!userId) return;

    try {
      // Initialize socket if not already done
      initSocket();
      const socket = getSocket();
      
      // Connect if not connected
      connectSocket();

      // Subscribe to ticket notifications
      socket.emit('ticket:subscribe');
      console.log('🎫 Subscribed to ticket notifications');

      // Listen for ticket events
      socket.on('ticket:received', handleTicketReceived);
      socket.on('ticket:balance-updated', handleBalanceUpdated);

      // Cleanup on unmount
      return () => {
        socket.emit('ticket:unsubscribe');
        socket.off('ticket:received', handleTicketReceived);
        socket.off('ticket:balance-updated', handleBalanceUpdated);
        console.log('🎫 Unsubscribed from ticket notifications');
      };
    } catch (error) {
      console.error('Error setting up ticket notifications:', error);
    }
  }, [userId, handleTicketReceived, handleBalanceUpdated]);
};

export default useTicketNotifications;
