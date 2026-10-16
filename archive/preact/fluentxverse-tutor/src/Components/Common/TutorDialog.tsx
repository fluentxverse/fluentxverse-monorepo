import type { ComponentChildren, RefObject } from 'preact';
import { createPortal } from 'preact/compat';
import { useLayoutEffect, useRef } from 'preact/hooks';
import './TutorDialog.css';

let locks = 0;
let previousOverflow = '';

export default function TutorDialog({ children, className = '', label, onClose, busy = false, dialogRef }: {
  children: ComponentChildren; className?: string; label: string; onClose: () => void; busy?: boolean; dialogRef?: RefObject<HTMLDialogElement>;
}) {
  const internalRef = useRef<HTMLDialogElement>(null);
  const ref = dialogRef ?? internalRef;
  useLayoutEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    if (!dialog) return;
    if (locks++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    dialog.showModal();
    return () => {
      dialog.close();
      if (--locks === 0) document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return createPortal(<dialog ref={ref} className={`tutor-dialog ${className}`} aria-label={label}
    aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget || busy) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>{children}</dialog>, document.body);
}
