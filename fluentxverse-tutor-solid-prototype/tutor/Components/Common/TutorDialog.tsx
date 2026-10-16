import { onMount, onCleanup, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import './TutorDialog.css';
let locks = 0;
let previousOverflow = '';
export default function TutorDialog(props: {
    children: JSX.Element;
    className?: string;
    label: string;
    onClose: () => void;
    busy?: boolean;
    dialogRef?: {
        current: HTMLDialogElement | null;
    };
}) {
    let dialog: HTMLDialogElement;
    onMount(() => {
        const opener = document.activeElement as HTMLElement | null;
        if (locks++ === 0) {
            previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        dialog.showModal();
        onCleanup(() => {
            dialog.close();
            if (--locks === 0)
                document.body.style.overflow = previousOverflow;
            if (opener?.isConnected)
                opener.focus();
        });
    });
    return <Portal><dialog ref={element => {
            dialog = element;
            if (props.dialogRef)
                props.dialogRef.current = element;
        }} class={`tutor-dialog ${props.className || ''}`} aria-label={props.label} aria-busy={props.busy || false} onCancel={event => {
            event.preventDefault();
            if (!props.busy)
                props.onClose();
        }} onClick={event => {
            if (event.target !== event.currentTarget || props.busy)
                return;
            const box = dialog.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)
                props.onClose();
        }}>{props.children}</dialog></Portal>;
}
