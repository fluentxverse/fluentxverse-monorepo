import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorDialog from "./TutorDialog";
import TutorIcon from ".//TutorIcon";
import { createContext } from "solid-js";
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
            }, _props1["toast"].duration || 5000);
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
    return (<div class={`toast fxv-toast toast-${_props1["toast"].type} ${isExiting() ? 'toast-exit' : ''}`} role="status">
      <div class="toast-icon-wrapper">
        <TutorIcon name={`toast-icon ${getIcon()}`}/>
      </div>
      <div class="toast-content">
        {_props1["toast"].title && <div class="toast-title">{_props1["toast"].title}</div>}
        <span class="toast-message">{_props1["toast"].message}</span>
      </div>
      <button class="toast-close" onClick={handleClose}>
        <TutorIcon name="ri-close-line"/>
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
    // Register global context for use outside React
    createEffect(on(() => [success(), error(), warning(), info(), confirm()], () => {
        const _cleanup4 = untrack(() => {
            setGlobalToastContext({ success: success(), error: error(), warning: warning(), info: info(), confirm: confirm() });
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
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
      {confirmState().isOpen && (<TutorDialog label="Confirm action" className="tutor-confirm-dialog" onClose={() => handleConfirm()(false)}>
          <div class="toast-confirm-modal" onClick={e => e.stopPropagation()}>
            {confirmState().title && (<h3 class="toast-confirm-title">{confirmState().title}</h3>)}
            <p class="toast-confirm-message">{confirmState().message}</p>
            <div class="toast-confirm-actions">
              <button type="button" class="toast-confirm-btn cancel" onClick={() => handleConfirm()(false)}>
                {confirmState().cancelLabel}
              </button>
              <button type="button" class="toast-confirm-btn confirm" onClick={() => handleConfirm()(true)}>
                {confirmState().confirmLabel}
              </button>
            </div>
          </div>
        </TutorDialog>)}
    </ToastContext.Provider>);
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
    }
};
// Async confirm dialog - replacement for window.confirm
export const toastConfirm = async (message: string, title?: string, options?: {
    confirmLabel?: string;
    cancelLabel?: string;
}): Promise<boolean> => {
    if (globalToastContext) {
        return globalToastContext.confirm(message, mergeProps({ title }, () => options));
    }
    console.warn('Toast not initialized. Falling back to native confirm.');
    return window.confirm(message);
};
export default ToastProvider;
