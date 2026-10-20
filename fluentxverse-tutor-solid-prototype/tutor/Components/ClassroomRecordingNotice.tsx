import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorDialog from './Common/TutorDialog';
import { AlertCircle, LoaderCircle, ShieldCheck, X } from "lucide-solid";
import type { Socket } from 'socket.io-client';
import './ClassroomRecordingNotice.css';
type RecordingState = {
    enabled: boolean;
    version: string;
    retentionDays: number;
    accepted: boolean | null;
    status: string;
    error?: string;
};
export function ClassroomRecordingNotice(_props0: {
    socket?: Socket | null;
    provider?: string;
    openRevision?: number;
    onAvailabilityChange?: (available: boolean) => void;
}) {
    const [state, setState] = createSignal<RecordingState | null>(null);
    const [open, setOpen] = createSignal(false);
    const [authority, setAuthority] = createSignal(false);
    const [pending, setPending] = createSignal(false);
    const [error, setError] = createSignal('');
    const errorRef = { current: null } as {
        current: HTMLParagraphElement | null;
    };
    const stateRef = { current: null } as {
        current: (RecordingState | null) | null;
    };
    const busy = { current: false } as {
        current: any;
    };
    const prompted = { current: false } as {
        current: any;
    };
    const epoch = { current: 0 } as {
        current: any;
    };
    const requestRevision = { current: 0 } as {
        current: any;
    };
    const lastRequest = { current: 0 } as {
        current: any;
    };
    const delay = { current: undefined } as {
        current: ReturnType<typeof setTimeout> | null;
    };
    const visible = createMemo(() => open() && _props0["provider"] === 'realtimekit' && Boolean(state()?.enabled));
    createEffect(on(() => [_props0["socket"], _props0["provider"]], () => {
        const _cleanup1 = untrack(() => {
            const generation = ++epoch.current;
            busy.current = false;
            setPending(false);
            if (_props0["provider"] !== 'realtimekit' || !_props0["socket"])
                return;
            let checking = false;
            const refresh = () => {
                if (!_props0["socket"].connected || checking || busy.current || stateRef.current)
                    return;
                checking = true;
                lastRequest.current = Date.now();
                const revision = requestRevision.current;
                _props0["socket"].timeout(8000).emit('classroom:recording-state', (timeout: Error | null, result: RecordingState) => {
                    checking = false;
                    if (generation !== epoch.current || revision !== requestRevision.current || busy.current)
                        return;
                    if (timeout || result?.error || typeof result?.enabled !== 'boolean')
                        return;
                    stateRef.current = result;
                    setState(result);
                    setError('');
                    if (result.enabled && result.accepted === null && !prompted.current) {
                        prompted.current = true;
                        setOpen(true);
                    }
                });
            };
            refresh();
            _props0["socket"].on('connect', refresh);
            const timer = setInterval(refresh, 10000);
            return () => { epoch.current++; clearInterval(timer); clearTimeout(delay.current); _props0["socket"].off('connect', refresh); };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [state()?.enabled, _props0["provider"], _props0["onAvailabilityChange"]], () => {
        const _cleanup2 = untrack(() => { _props0["onAvailabilityChange"]?.(_props0["provider"] === 'realtimekit' && Boolean(state()?.enabled)); });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    createEffect(on(() => [_props0["openRevision"] === undefined ? 0 : _props0["openRevision"]], () => {
        const _cleanup3 = untrack(() => {
            if ((_props0["openRevision"] === undefined ? 0 : _props0["openRevision"]) && stateRef.current?.enabled) {
                setAuthority(stateRef.current.accepted === true);
                setError('');
                setOpen(true);
            }
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    createEffect(on(() => [error()], () => {
        const _cleanup4 = untrack(() => {
            if (error())
                errorRef.current?.focus();
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    const decide = (accepted: boolean) => {
        if (!state() || !_props0["socket"] || busy.current || (accepted && !authority()))
            return;
        if (!_props0["socket"].connected) {
            setError('You are offline. Reconnect, then try again.');
            return;
        }
        busy.current = true;
        setPending(true);
        setError('');
        requestRevision.current++;
        const generation = epoch.current;
        // The server rate-limits notice requests, including the initial status read.
        delay.current = setTimeout(() => {
            if (generation !== epoch.current)
                return;
            lastRequest.current = Date.now();
            _props0["socket"].timeout(8000).emit('classroom:recording-consent', { accepted, authority: accepted && authority(), version: state().version }, (timeout: Error | null, result: RecordingState) => {
                if (generation !== epoch.current)
                    return;
                busy.current = false;
                setPending(false);
                if (timeout || result?.error || result?.accepted !== accepted) {
                    setError('Could not save your recording choice. Please try again.');
                    return;
                }
                stateRef.current = result;
                setState(result);
                setError('');
                setOpen(false);
            });
        }, Math.max(0, 550 - (Date.now() - lastRequest.current)));
    };
    return createMemo(() => {
        if (!visible() || !state())
            return null;
        return <TutorDialog className="tutor-recording-dialog" label="Lesson recording" onClose={() => setOpen(false)} busy={pending()}>
    <header><img src="/assets/img/home-icons/video-v1.webp" alt=""/><h2 id="tutor-recording-title" tabIndex={-1}>Lesson recording</h2>
      <button class="recording-close" type="button" disabled={pending()} title="Close recording permission" aria-label="Close recording permission" onClick={() => {
                if (!busy.current)
                    setOpen(false);
            }}><X size={20}/></button></header>
    <div class="recording-dialog-body">
      {error() && <p class="recording-error" role="alert" tabIndex={-1} ref={_element => errorRef.current = _element}><AlertCircle size={18}/>{error()}</p>}
      <p id="tutor-recording-description">May we record this lesson for quality assurance? Recording starts only when both you and your student agree.</p>
      <p class="recording-details">Cloudflare processes the recording. An encrypted copy is kept on FluentXVerse servers for {state().retentionDays} days and can be reviewed only by authorized administrators.</p>
      <p class="recording-details">Your lesson continues normally if you decline. Your choice is optional and can be changed later.</p>
      {state().accepted !== null && <p class="recording-current-choice">Current choice: {state().accepted ? 'Recording allowed' : 'No recording'}</p>}
      <label class="recording-authority"><input type="checkbox" checked={authority()} disabled={pending()} onClick={event => setAuthority(event.currentTarget.checked)}/><span>I am an adult and agree to recording my participation in this lesson.</span></label>
    </div>
    <footer><button type="button" class="recording-decline" disabled={pending()} onClick={() => decide(false)}>Don't record</button>
      <button type="button" class="recording-agree" disabled={!authority() || pending()} onClick={() => decide(true)}>{pending() ? <LoaderCircle size={18} class="recording-spinner"/> : <ShieldCheck size={18}/>}Agree</button>
      {pending() && <span class="recording-saving" role="status">Saving your choice...</span>}</footer>
  </TutorDialog>;
    }) as unknown as JSX.Element;
}
