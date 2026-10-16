import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { useAuthContext } from '../context/AuthContext';
import { useClassroomSessionRefresh } from '../hooks/useClassroomSessionRefresh';
import { useToastContext } from '../context/ToastContext';
import StudentDialog from './Common/StudentDialog';
import { RotateCw } from "lucide-solid";
interface Props {
    isAuthenticated: boolean;
    autoRefresh?: boolean;
    onRefreshed?: () => void;
    // Optional override; defaults to 30 minutes
    sessionMinutes?: number;
    // Warn when this many minutes remain (default 3)
    warnMinutes?: number;
}
export default function SessionExpiryModal(_props0: Props) {
    const [show, setShow] = createSignal(false);
    const [refreshing, setRefreshing] = createSignal(false);
    const [remaining, setRemaining] = createSignal((_props0["sessionMinutes"] === undefined ? 30 : _props0["sessionMinutes"]) * 60); // seconds
    const startTimeRef = { current: Date.now() } as {
        current: number | null;
    };
    const _state1 = useToastContext();
    const _state2 = useAuthContext();
    useClassroomSessionRefresh(() => _props0["isAuthenticated"] && (_props0["autoRefresh"] === undefined ? false : _props0["autoRefresh"]), _state2.ensureSession, () => {
        startTimeRef.current = Date.now();
        setRemaining((_props0["sessionMinutes"] === undefined ? 30 : _props0["sessionMinutes"]) * 60);
        setShow(false);
        _props0["onRefreshed"]?.();
    });
    createEffect(on(() => [_props0["isAuthenticated"], _props0["autoRefresh"] === undefined ? false : _props0["autoRefresh"], _props0["sessionMinutes"] === undefined ? 30 : _props0["sessionMinutes"], _props0["warnMinutes"] === undefined ? 3 : _props0["warnMinutes"]], () => {
        const _cleanup3 = untrack(() => {
            if (!_props0["isAuthenticated"] || (_props0["autoRefresh"] === undefined ? false : _props0["autoRefresh"])) {
                setShow(false);
                return;
            }
            // Track session time in memory; reset on mount
            startTimeRef.current = Date.now();
            setShow(false);
            setRemaining((_props0["sessionMinutes"] === undefined ? 30 : _props0["sessionMinutes"]) * 60);
            const interval = window.setInterval(() => {
                const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
                const left = (_props0["sessionMinutes"] === undefined ? 30 : _props0["sessionMinutes"]) * 60 - elapsedSec;
                setRemaining(left);
                if (left <= (_props0["warnMinutes"] === undefined ? 3 : _props0["warnMinutes"]) * 60)
                    setShow(true);
                if (left <= 0) {
                    window.clearInterval(interval);
                    setShow(false);
                }
            }, 1000);
            return () => {
                window.clearInterval(interval);
            };
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const onRefresh = async () => {
        if (refreshing())
            return;
        setRefreshing(true);
        try {
            await _state2.ensureSession();
            startTimeRef.current = Date.now();
            setShow(false);
            setRemaining((_props0["sessionMinutes"] === undefined ? 30 : _props0["sessionMinutes"]) * 60);
            _props0["onRefreshed"]?.();
            _state1.showSuccess('Session refreshed. You can continue where you left off.');
        }
        catch (e) {
            _state1.showError('Could not refresh your session. Please try again.');
        }
        finally {
            setRefreshing(false);
        }
    };
    return createMemo(() => {
        if ((_props0["autoRefresh"] === undefined ? false : _props0["autoRefresh"]) || !show())
            return null;
        const minutes = createMemo(() => Math.max(0, Math.floor(remaining() / 60)));
        const seconds = createMemo(() => Math.max(0, remaining() % 60));
        return (<StudentDialog label="Session expiring soon" onClose={() => setShow(false)} busy={refreshing()}>
      <div class="session-modal">
        <img class="student-dialog-art" src="/assets/img/home-icons/schedule-v1.webp" alt=""/><h2>Session expiring soon</h2>
        <div class="session-body">
          Your session will expire in <strong>{minutes()}:{seconds().toString().padStart(2, '0')}</strong>.
        </div>
        <div class="student-dialog-actions">
          <button class="primary" onClick={onRefresh} disabled={refreshing()}>
            <RotateCw size={16}/>{refreshing() ? 'Refreshing...' : 'Refresh session'}
          </button>
          <button disabled={refreshing()} onClick={() => setShow(false)}>
            Dismiss
          </button>
        </div>
      </div>
    </StudentDialog>);
    }) as unknown as JSX.Element;
}
