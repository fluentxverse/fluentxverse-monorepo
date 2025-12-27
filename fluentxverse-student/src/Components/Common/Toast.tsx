import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
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
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

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
    <div className={`toast toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}>
      <i className={`toast-icon ${getIcon()}`}></i>
      <div className="toast-content">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <span className="toast-message">{toast.message}</span>
      </div>
      <button className="toast-close" onClick={handleClose}>
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

// Confirmation dialog state
interface ConfirmState {
  isOpen: boolean;
  message: string;
  title?: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: ((value: boolean) => void) | null;
}

// Toast Context for provider pattern
interface ToastContextValue {
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  confirm: (message: string, options?: {
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};

// Toast Provider Component
export const ToastProvider = ({ children }: { children: any }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    message: '',
    title: undefined,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    resolve: null,
  });

  const addToast = useCallback((type: ToastType, message: string, title?: string, duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { id, type, message, title, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((message: string, title?: string) => addToast('success', message, title), [addToast]);
  const error = useCallback((message: string, title?: string) => addToast('error', message, title, 8000), [addToast]);
  const warning = useCallback((message: string, title?: string) => addToast('warning', message, title, 6000), [addToast]);
  const info = useCallback((message: string, title?: string) => addToast('info', message, title), [addToast]);

  const confirm = useCallback((message: string, options?: {
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        title: options?.title,
        confirmLabel: options?.confirmLabel ?? 'Confirm',
        cancelLabel: options?.cancelLabel ?? 'Cancel',
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback((result: boolean) => {
    if (confirmState.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [confirmState.resolve]);

  return (
    <ToastContext.Provider value={{ success, error, warning, info, confirm }}>
      {children}
      <Toast toasts={toasts} onRemove={removeToast} />
      
      {/* Confirmation Modal */}
      {confirmState.isOpen && (
        <div className="toast-confirm-overlay" onClick={() => handleConfirm(false)}>
          <div className="toast-confirm-modal" onClick={e => e.stopPropagation()}>
            {confirmState.title && (
              <h3 className="toast-confirm-title">{confirmState.title}</h3>
            )}
            <p className="toast-confirm-message">{confirmState.message}</p>
            <div className="toast-confirm-actions">
              <button
                type="button"
                className="toast-confirm-btn cancel"
                onClick={() => handleConfirm(false)}
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                className="toast-confirm-btn confirm"
                onClick={() => handleConfirm(true)}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

// Toast hook for easy usage (legacy support)
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

// Async confirm dialog - replacement for window.confirm
export const toastConfirm = async (
  message: string,
  title?: string,
  options?: { confirmLabel?: string; cancelLabel?: string }
): Promise<boolean> => {
  // For now, fallback to native confirm - can be enhanced with modal later
  return window.confirm(title ? `${title}\n\n${message}` : message);
};

export default Toast;
