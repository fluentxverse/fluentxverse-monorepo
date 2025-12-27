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
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return 'ri-check-line';
      case 'error':
        return 'ri-close-circle-line';
      case 'warning':
        return 'ri-alert-line';
      case 'info':
      default:
        return 'ri-information-line';
    }
  };

  return (
    <div className={`toast toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}>
      <div className="toast-icon-wrapper">
        <i className={`toast-icon ${getIcon()}`}></i>
      </div>
      <div className="toast-content">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <span className="toast-message">{toast.message}</span>
      </div>
      <button className="toast-close" onClick={handleClose}>
        <i className="ri-close-line"></i>
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

// Toast Context
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

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
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

  // Register global context for use outside React
  useEffect(() => {
    setGlobalToastContext({ success, error, warning, info, confirm });
  }, [success, error, warning, info, confirm]);

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

// Global toast instance for use outside of React components
let globalToastContext: ToastContextValue | null = null;

export const setGlobalToastContext = (context: ToastContextValue) => {
  globalToastContext = context;
};

// Global toast functions - can be called from anywhere
export const toast = {
  success: (message: string, title?: string) => {
    if (globalToastContext) {
      return globalToastContext.success(message, title);
    }
    console.warn('Toast not initialized. Make sure ToastProvider is mounted.');
    return '';
  },
  error: (message: string, title?: string) => {
    if (globalToastContext) {
      return globalToastContext.error(message, title);
    }
    console.warn('Toast not initialized. Make sure ToastProvider is mounted.');
    return '';
  },
  warning: (message: string, title?: string) => {
    if (globalToastContext) {
      return globalToastContext.warning(message, title);
    }
    console.warn('Toast not initialized. Make sure ToastProvider is mounted.');
    return '';
  },
  info: (message: string, title?: string) => {
    if (globalToastContext) {
      return globalToastContext.info(message, title);
    }
    console.warn('Toast not initialized. Make sure ToastProvider is mounted.');
    return '';
  },
};

// Async confirm dialog - replacement for window.confirm
export const toastConfirm = async (
  message: string,
  title?: string,
  options?: { confirmLabel?: string; cancelLabel?: string }
): Promise<boolean> => {
  if (globalToastContext) {
    return globalToastContext.confirm(message, { title, ...options });
  }
  console.warn('Toast not initialized. Falling back to native confirm.');
  return window.confirm(message);
};

export default ToastProvider;
