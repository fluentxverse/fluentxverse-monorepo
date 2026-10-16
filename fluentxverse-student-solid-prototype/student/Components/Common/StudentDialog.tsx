import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import './StudentDialog.css';
let locks = 0;
let previousOverflow = '';
export default function StudentDialog(_props0: {
    children: JSX.Element;
    className?: string;
    label: string;
    onClose: () => void;
    busy?: boolean;
}) {
    const ref = { current: null } as {
        current: HTMLDialogElement | null;
    };
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            const dialog = ref.current;
            const opener = document.activeElement as HTMLElement | null;
            if (!dialog)
                return;
            if (locks++ === 0) {
                previousOverflow = document.body.style.overflow;
                document.body.style.overflow = 'hidden';
            }
            dialog.showModal();
            return () => {
                dialog.close();
                if (--locks === 0)
                    document.body.style.overflow = previousOverflow;
                if (opener?.isConnected)
                    opener.focus();
            };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    return <Portal mount={document.body}>{<dialog ref={_element => ref.current = _element} class={`student-dialog ${_props0["className"] === undefined ? '' : _props0["className"]}`} aria-label={_props0["label"]} aria-busy={_props0["busy"] === undefined ? false : _props0["busy"]} onCancel={event => { event.preventDefault(); if (!(_props0["busy"] === undefined ? false : _props0["busy"]))
        _props0["onClose"](); }} onClick={event => {
            if (event.target !== event.currentTarget || (_props0["busy"] === undefined ? false : _props0["busy"]))
                return;
            const box = event.currentTarget.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)
                _props0["onClose"]();
        }}>{_props0["children"]}</dialog>}</Portal>;
}
