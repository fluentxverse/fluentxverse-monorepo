import { createContext } from 'preact';
import { useState, useContext, useCallback } from 'preact/hooks';
import { JSX } from 'preact';
import { Toast, ToastMessage, ToastType } from '../Components/Common/Toast';

interface ToastContextType {
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

export const ToastProvider = ({ children }: { children: JSX.Element | JSX.Element[] }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = `toast-${++toastId}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    addToast('success', message, duration);
  }, [addToast]);

  const showError = useCallback((message: string, duration?: number) => {
    addToast('error', message, duration);
  }, [addToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    addToast('info', message, duration);
  }, [addToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    addToast('warning', message, duration);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo, showWarning }}>
      {children}
      <Toast toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return no-op functions if not inside provider (for SSR safety)
    return {
      showSuccess: () => {},
      showError: () => {},
      showInfo: () => {},
      showWarning: () => {},
    };
  }
  return context;
};

// Global toast functions for non-component use
let globalToastContext: ToastContextType | null = null;

export const setGlobalToastContext = (context: ToastContextType) => {
  globalToastContext = context;
};

export const globalToast = {
  success: (message: string, duration?: number) => {
    if (globalToastContext) {
      globalToastContext.showSuccess(message, duration);
    } else {
      console.log('Toast (not mounted):', message);
    }
  },
  error: (message: string, duration?: number) => {
    if (globalToastContext) {
      globalToastContext.showError(message, duration);
    } else {
      console.error('Toast (not mounted):', message);
    }
  },
  info: (message: string, duration?: number) => {
    if (globalToastContext) {
      globalToastContext.showInfo(message, duration);
    } else {
      console.log('Toast (not mounted):', message);
    }
  },
  warning: (message: string, duration?: number) => {
    if (globalToastContext) {
      globalToastContext.showWarning(message, duration);
    } else {
      console.warn('Toast (not mounted):', message);
    }
  },
};
