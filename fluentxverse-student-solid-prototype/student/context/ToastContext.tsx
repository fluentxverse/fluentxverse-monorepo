import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { createContext } from "solid-js";
import { JSX } from "solid-js";
import { Toast, ToastMessage, ToastType } from '../Components/Common/Toast';
interface ToastContextType {
    showSuccess: (message: string, duration?: number) => void;
    showError: (message: string, duration?: number) => void;
    showInfo: (message: string, duration?: number) => void;
    showWarning: (message: string, duration?: number) => void;
}
const ToastContext = createContext<ToastContextType | null>(null);
let toastId = 0;
export const ToastProvider = (_props0: {
    children: JSX.Element | JSX.Element[];
}) => {
    const [toasts, setToasts] = createSignal<ToastMessage[]>([]);
    const addToast = createMemo(on(() => [], () => (type: ToastType, message: string, duration = 4000) => {
        const id = `toast-${++toastId}`;
        setToasts((prev) => [...prev, { id, type, message, duration }]);
        return id;
    }));
    const removeToast = createMemo(on(() => [], () => (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }));
    const showSuccess = createMemo(on(() => [addToast()], () => (message: string, duration?: number) => {
        addToast()('success', message, duration);
    }));
    const showError = createMemo(on(() => [addToast()], () => (message: string, duration?: number) => {
        addToast()('error', message, duration);
    }));
    const showInfo = createMemo(on(() => [addToast()], () => (message: string, duration?: number) => {
        addToast()('info', message, duration);
    }));
    const showWarning = createMemo(on(() => [addToast()], () => (message: string, duration?: number) => {
        addToast()('warning', message, duration);
    }));
    return (<ToastContext.Provider value={{ get showSuccess() {
            return showSuccess();
        }, get showError() {
            return showError();
        }, get showInfo() {
            return showInfo();
        }, get showWarning() {
            return showWarning();
        } }}>
      {_props0["children"]}
      <Toast toasts={toasts()} onRemove={removeToast()}/>
    </ToastContext.Provider>);
};
export const useToastContext = () => {
    const context = useContext(ToastContext);
    if (!context) {
        // Return no-op functions if not inside provider (for SSR safety)
        return {
            showSuccess: () => { },
            showError: () => { },
            showInfo: () => { },
            showWarning: () => { }
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
        }
        else {
        }
    },
    error: (message: string, duration?: number) => {
        if (globalToastContext) {
            globalToastContext.showError(message, duration);
        }
        else {
            console.error('Toast (not mounted):', message);
        }
    },
    info: (message: string, duration?: number) => {
        if (globalToastContext) {
            globalToastContext.showInfo(message, duration);
        }
        else {
        }
    },
    warning: (message: string, duration?: number) => {
        if (globalToastContext) {
            globalToastContext.showWarning(message, duration);
        }
        else {
            console.warn('Toast (not mounted):', message);
        }
    }
};
