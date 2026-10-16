import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { createContext } from "solid-js";
import StudentDialog from './StudentDialog';
import { X, CircleCheck, CircleX, TriangleAlert, Info } from "lucide-solid";
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
export const Toast = (_props0: ToastProps) => {
    return (<div class="toast-container">
      {_props0["toasts"].map((toast) => (<ToastItem toast={toast} onRemove={_props0["onRemove"]}/>))}
    </div>);
};
const ToastItem = (_props1: {
    toast: ToastMessage;
    onRemove: (id: string) => void;
}) => {
    const [isExiting, setIsExiting] = createSignal(false);
    createEffect(on(() => [_props1["toast"].id, _props1["toast"].duration, _props1["onRemove"]], () => {
        const _cleanup3 = untrack(() => {
            const timer = setTimeout(() => {
                setIsExiting(true);
                setTimeout(() => _props1["onRemove"](_props1["toast"].id), 300);
            }, _props1["toast"].duration || 3000);
            return () => clearTimeout(timer);
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => _props1["onRemove"](_props1["toast"].id), 300);
    };
    const getIcon = () => {
        switch (_props1["toast"].type) {
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
    return (<div class={`toast toast-${_props1["toast"].type} ${isExiting() ? 'toast-exit' : ''}`}>
      {_props1["toast"].type === 'success' ? <CircleCheck size={20}/> : _props1["toast"].type === 'error' ? <CircleX size={20}/> : _props1["toast"].type === 'warning' ? <TriangleAlert size={20}/> : <Info size={20}/>}
      <div class="toast-content">
        {_props1["toast"].title && <div class="toast-title">{_props1["toast"].title}</div>}
        <span class="toast-message">{_props1["toast"].message}</span>
      </div>
      <button class="toast-close" aria-label="Dismiss notification" title="Dismiss notification" onClick={handleClose}>
        <X size={16}/>
      </button>
    </div>);
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
export const ToastProvider = (_props2: {
    children: any;
}) => {
    const [toasts, setToasts] = createSignal<ToastMessage[]>([]);
    const [confirmState, setConfirmState] = createSignal<ConfirmState>({
        isOpen: false,
        message: '',
        title: undefined,
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        resolve: null
    });
    const addToast = createMemo(on(() => [], () => (type: ToastType, message: string, title?: string, duration = 5000) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts(prev => [...prev, { id, type, message, title, duration }]);
        return id;
    }));
    const removeToast = createMemo(on(() => [], () => (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }));
    const success = createMemo(on(() => [addToast()], () => (message: string, title?: string) => addToast()('success', message, title)));
    const error = createMemo(on(() => [addToast()], () => (message: string, title?: string) => addToast()('error', message, title, 8000)));
    const warning = createMemo(on(() => [addToast()], () => (message: string, title?: string) => addToast()('warning', message, title, 6000)));
    const info = createMemo(on(() => [addToast()], () => (message: string, title?: string) => addToast()('info', message, title)));
    const confirm = createMemo(on(() => [], () => (message: string, options?: {
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
                resolve
            });
        });
    }));
    const handleConfirm = createMemo(on(() => [confirmState().resolve], () => (result: boolean) => {
        if (confirmState().resolve) {
            confirmState().resolve(result);
        }
        setConfirmState(prev => ({ ...prev, isOpen: false, resolve: null }));
    }));
    return (<ToastContext.Provider value={{ get success() {
            return success();
        }, get error() {
            return error();
        }, get warning() {
            return warning();
        }, get info() {
            return info();
        }, get confirm() {
            return confirm();
        } }}>
      {_props2["children"]}
      <Toast toasts={toasts()} onRemove={removeToast()}/>
      
      {/* Confirmation Modal */}
      {confirmState().isOpen && (<StudentDialog className="student-confirm-dialog" label={confirmState().title || 'Confirm action'} onClose={() => handleConfirm()(false)}>
          <div><img class="student-dialog-art" src="/assets/img/home-icons/community-v1.webp" alt=""/>
            {confirmState().title && (<h2>{confirmState().title}</h2>)}
            <p class="toast-confirm-message">{confirmState().message}</p>
            <div class="student-dialog-actions">
              <button type="button" class="secondary" onClick={() => handleConfirm()(false)}>
                {confirmState().cancelLabel}
              </button>
              <button type="button" class="primary" onClick={() => handleConfirm()(true)}>
                {confirmState().confirmLabel}
              </button>
            </div>
          </div>
        </StudentDialog>)}
    </ToastContext.Provider>);
};
// Toast hook for easy usage (legacy support)
let toastId = 0;
let globalSetToasts: ((fn: (prev: ToastMessage[]) => ToastMessage[]) => void) | null = null;
export const useToast = () => {
    const [toasts, setToasts] = createSignal<ToastMessage[]>([]);
    createEffect(on(() => [], () => {
        const _cleanup4 = untrack(() => {
            globalSetToasts = setToasts;
            return () => {
                globalSetToasts = null;
            };
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
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
        get toasts() {
            return toasts();
        },
        addToast,
        removeToast,
        showSuccess,
        showError,
        showInfo,
        showWarning
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
    }
};
// Async confirm dialog - replacement for window.confirm
export const toastConfirm = async (message: string, title?: string, options?: {
    confirmLabel?: string;
    cancelLabel?: string;
}): Promise<boolean> => {
    // For now, fallback to native confirm - can be enhanced with modal later
    return window.confirm(title ? `${title}\n\n${message}` : message);
};
export default Toast;
