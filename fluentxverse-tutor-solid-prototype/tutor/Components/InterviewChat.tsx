import { createEffect, createSignal, For } from 'solid-js';
import { Send } from 'lucide-solid';
import { INTERVIEW_MESSAGE_LIMIT, type InterviewMessage } from '../../../shared/interviewChat';
import '../../../shared/ui/interview-chat.css';

export default function InterviewChat(props: { messages: InterviewMessage[]; ready: boolean; ended: boolean; send: (text: string) => void }) {
  const [draft, setDraft] = createSignal('');
  const [error, setError] = createSignal('');
  let log!: HTMLDivElement;
  createEffect(() => { props.messages.length; if (log) log.scrollTop = log.scrollHeight; });
  const send = (event: SubmitEvent) => {
    event.preventDefault();
    try { props.send(draft()); setDraft(''); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Message could not be sent. Please retry.'); }
  };
  return <section class="interview-chat" aria-label="Interview chat">
    <header><h2>Interview chat</h2><span role="status">{props.ended ? 'Interview ended' : props.ready ? 'Connected' : 'Waiting for connection'}</span></header>
    <div ref={log} class="interview-chat-log" role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions">
      {!props.messages.length && <p class="interview-chat-empty">No messages yet.</p>}
      <For each={props.messages}>{message => <div class={`interview-chat-message${message.mine ? ' mine' : ''}`}><strong>{message.mine ? 'You' : 'Interviewer'}</strong><p>{message.text}</p></div>}</For>
    </div>
    <form onSubmit={send}>
      <textarea aria-label="Message" placeholder="Type a message..." rows={3} maxLength={INTERVIEW_MESSAGE_LIMIT} value={draft()} disabled={props.ended} onInput={event => { setDraft(event.currentTarget.value); setError(''); }} onPaste={event => { if (event.clipboardData?.files.length) event.preventDefault(); }} onDrop={event => event.preventDefault()} />
      <button type="submit" title="Send message" aria-label="Send message" disabled={props.ended || !props.ready || !draft().trim()}><Send size={18}/></button>
    </form>
    {error() && <p class="interview-chat-error" role="alert">{error()}</p>}
  </section>;
}
