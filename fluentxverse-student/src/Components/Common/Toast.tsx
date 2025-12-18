import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export const Toast = ({ toasts, onRemove }: ToastProps) => {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return 'fas fa-check-circle';
      case 'error':
        return 'fas fa-times-circle';
      case 'warning':
        return 'fas fa-exclamation-triangle';
      case 'info':
      default:
        return 'fas fa-info-circle';
    }
  };

  return (
    <div className={`toast toast-${toast.type}`}>
      <i className={`toast-icon ${getIcon()}`}></i>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={() => onRemove(toast.id)}>
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

// Toast hook for easy usage
let toastId = 0;
let globalSetToasts: ((fn: (prev: ToastMessage[]) => ToastMessage[]) => void) | null = null;

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    globalSetToasts = setToasts;
    return () => {
      globalSetToasts = null;
    };
  }, []);

  const addToast = (type: ToastType, message: string, duration = 3000) => {
    const id = `toast-${++toastId}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showSuccess = (message: string, duration?: number) => addToast('success', message, duration);
  const showError = (message: string, duration?: number) => addToast('error', message, duration);
  const showInfo = (message: string, duration?: number) => addToast('info', message, duration);
  const showWarning = (message: string, duration?: number) => addToast('warning', message, duration);

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
  };
};

// Global toast function (for use outside of React components)
export const toast = {
  success: (message: string, duration = 3000) => {
    if (globalSetToasts) {
      const id = `toast-${++toastId}`;
      globalSetToasts((prev) => [...prev, { id, type: 'success', message, duration }]);
    }
  },
  error: (message: string, duration = 3000) => {
    if (globalSetToasts) {
      const id = `toast-${++toastId}`;
      globalSetToasts((prev) => [...prev, { id, type: 'error', message, duration }]);
    }
  },
  info: (message: string, duration = 3000) => {
    if (globalSetToasts) {
      const id = `toast-${++toastId}`;
      globalSetToasts((prev) => [...prev, { id, type: 'info', message, duration }]);
    }
  },
  warning: (message: string, duration = 3000) => {
    if (globalSetToasts) {
      const id = `toast-${++toastId}`;
      globalSetToasts((prev) => [...prev, { id, type: 'warning', message, duration }]);
    }
  },
};

export default Toast;
