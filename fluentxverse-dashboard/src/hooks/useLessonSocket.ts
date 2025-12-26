import { useEffect, useRef, useCallback, useState } from 'preact/hooks';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8767';

export interface ActiveEditor {
  odI: string;
  socketId: string;
  userName: string;
  startedAt: Date;
}

export interface EditingActivity {
  lessonId: string;
  odI: string;
  userName: string;
  section: string;
  action: string;
  timestamp: Date;
}

export interface LessonUpdate {
  lessonId: string;
  savedBy: string;
  savedByName: string;
  version: number;
  timestamp: Date;
}

interface UseLessonSocketOptions {
  lessonId: string | null;
  userId?: string;
  userName?: string;
  onEditorsChange?: (editors: ActiveEditor[]) => void;
  onEditorJoined?: (editor: { odI: string; userName: string }) => void;
  onEditorLeft?: (editor: { odI: string; userName: string }) => void;
  onActivity?: (activity: EditingActivity) => void;
  onLessonUpdated?: (update: LessonUpdate) => void;
}

export function useLessonSocket({
  lessonId,
  onEditorsChange,
  onEditorJoined,
  onEditorLeft,
  onActivity,
  onLessonUpdated
}: UseLessonSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeEditors, setActiveEditors] = useState<ActiveEditor[]>([]);

  // Initialize socket connection
  useEffect(() => {
    // Get auth token from cookies if needed
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Lesson socket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Lesson socket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Lesson socket connection error:', error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Join/leave lesson room when lessonId changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !lessonId) return;

    // Join the lesson room
    socket.emit('lesson:join', lessonId);

    // Set up event listeners
    socket.on('lesson:editors', (data: { lessonId: string; editors: ActiveEditor[] }) => {
      if (data.lessonId === lessonId) {
        setActiveEditors(data.editors);
        onEditorsChange?.(data.editors);
      }
    });

    socket.on('lesson:editor-joined', (data: { lessonId: string; odI: string; userName: string; startedAt: Date }) => {
      if (data.lessonId === lessonId) {
        setActiveEditors(prev => [...prev, { odI: data.odI, socketId: '', userName: data.userName, startedAt: new Date(data.startedAt) }]);
        onEditorJoined?.(data);
      }
    });

    socket.on('lesson:editor-left', (data: { lessonId: string; odI: string; userName: string }) => {
      if (data.lessonId === lessonId) {
        setActiveEditors(prev => prev.filter(e => e.odI !== data.odI));
        onEditorLeft?.(data);
      }
    });

    socket.on('lesson:activity', (data: EditingActivity) => {
      if (data.lessonId === lessonId) {
        onActivity?.(data);
      }
    });

    socket.on('lesson:updated', (data: LessonUpdate) => {
      if (data.lessonId === lessonId) {
        onLessonUpdated?.(data);
      }
    });

    // Cleanup on lessonId change
    return () => {
      socket.emit('lesson:leave', lessonId);
      socket.off('lesson:editors');
      socket.off('lesson:editor-joined');
      socket.off('lesson:editor-left');
      socket.off('lesson:activity');
      socket.off('lesson:updated');
    };
  }, [lessonId, onEditorsChange, onEditorJoined, onEditorLeft, onActivity, onLessonUpdated]);

  // Start editing notification
  const startEditing = useCallback(() => {
    const socket = socketRef.current;
    if (socket && lessonId) {
      socket.emit('lesson:start-editing', lessonId);
    }
  }, [lessonId]);

  // Stop editing notification
  const stopEditing = useCallback(() => {
    const socket = socketRef.current;
    if (socket && lessonId) {
      socket.emit('lesson:stop-editing', lessonId);
    }
  }, [lessonId]);

  // Send editing activity (typing, selecting section, etc.)
  const sendActivity = useCallback((section: string, action: string) => {
    const socket = socketRef.current;
    if (socket && lessonId) {
      socket.emit('lesson:editing-activity', { lessonId, section, action });
    }
  }, [lessonId]);

  // Notify that lesson was saved
  const notifySaved = useCallback((version: number) => {
    const socket = socketRef.current;
    if (socket && lessonId) {
      socket.emit('lesson:saved', { lessonId, version });
    }
  }, [lessonId]);

  return {
    isConnected,
    activeEditors,
    startEditing,
    stopEditing,
    sendActivity,
    notifySaved
  };
}
