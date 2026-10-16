import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { ArrowLeft, CheckCheck, CircleAlert, Inbox, Mail, Pin, RotateCw } from "lucide-solid";
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { inboxApi, type SystemMessage } from '../api/inbox.api';
import './InboxPage.css';
const categories = { announcement: 'Announcement', update: 'Update', alert: 'Alert', news: 'News', promotion: 'Promotion' };
export default function InboxPage() {
    const _state0 = useAuthContext();
    const [messages, setMessages] = createSignal<SystemMessage[]>([]);
    const [selectedId, setSelectedId] = createSignal<string | null>(null);
    const [filter, setFilter] = createSignal<'all' | 'unread' | 'pinned'>('all');
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal('');
    const [busy, setBusy] = createSignal(false);
    const busyRef = { current: false } as {
        current: any;
    };
    const revision = { current: 0 } as {
        current: any;
    };
    const detailHeading = { current: null } as {
        current: HTMLHeadingElement | null;
    };
    const userId = createMemo(() => _state0.user?.userId || '');
    const load = async () => {
        const request = ++revision.current;
        if (!userId()) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const result = await inboxApi.getMessages({ get userId() {
                    return userId();
                } });
            if (request === revision.current)
                setMessages(result.messages);
        }
        catch (err) {
            if (request === revision.current)
                setError(err instanceof Error ? err.message : 'Could not load messages.');
        }
        finally {
            if (request === revision.current)
                setLoading(false);
        }
    };
    createEffect(on(() => [userId()], () => {
        const _cleanup1 = untrack(() => { document.title = 'Inbox | FluentXVerse'; load(); return () => { revision.current++; }; });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [selectedId()], () => {
        const _cleanup2 = untrack(() => { if (selectedId())
            detailHeading.current?.focus(); });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const mutate = async (action: () => Promise<void>) => {
        if (busyRef.current)
            return;
        busyRef.current = true;
        setBusy(true);
        setError('');
        try {
            await action();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update your inbox. Please try again.');
        }
        finally {
            busyRef.current = false;
            setBusy(false);
        }
    };
    const open = async (message: SystemMessage) => {
        setSelectedId(message.id);
        if (!message.isRead)
            await mutate(async () => {
                await inboxApi.markAsRead(message.id, userId());
                setMessages(prev => prev.map(item => item.id === message.id ? { ...item, isRead: true } : item));
            });
    };
    const selected = createMemo(() => messages().find(message => message.id === selectedId()));
    const unread = createMemo(() => messages().filter(message => !message.isRead).length);
    const items = createMemo(() => messages().filter(message => filter() === 'all' || (filter() === 'unread' ? !message.isRead : message.isPinned))
        .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || Date.parse(b.createdAt) - Date.parse(a.createdAt)));
    const date = (value: string) => new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' JST';
    return <><SideBar /><div class="student-inbox-shell"><Header /><main class="inbox-page">
    <div class="inbox-container">
      <header class="inbox-header"><div class="inbox-heading"><img src="/assets/img/home-icons/community-v1.webp" alt="" width="48" height="48"/><div><h1>Inbox</h1><p>{unread()} unread messages</p></div></div>
        <button class="inbox-command" disabled={!unread() || busy() || loading()} onClick={() => mutate(async () => {
            await inboxApi.markAllAsRead(userId());
            setMessages(prev => prev.map(message => ({ ...message, isRead: true })));
        })}><CheckCheck size={18}/>Mark all as read</button>
      </header>
      {error() && <div class="inbox-error" role="alert"><CircleAlert size={18}/><span>{error()}</span><button class="inbox-command" disabled={busy()} onClick={load}><RotateCw size={16}/>Reload</button></div>}
      <nav class="inbox-filters" aria-label="Message filters">{(['all', 'unread', 'pinned'] as const).map(value => <button aria-pressed={filter() === value} onClick={() => { setFilter(value); setSelectedId(null); }}><span>{value === 'all' ? 'All messages' : value === 'unread' ? 'Unread' : 'Pinned'}</span></button>)}</nav>
      <div class={`inbox-content ${selected() ? 'inbox-reading' : ''}`}>
        <div class="messages-list" aria-label="Messages">{loading() ? <div class="inbox-state" role="status"><Mail size={24}/><p>Loading messages...</p></div> : !items().length ? <div class="inbox-state"><img src="/assets/img/home-icons/community-v1.webp" alt="" width="64" height="64"/><h2>{filter() === 'unread' ? 'All caught up' : filter() === 'pinned' ? 'No pinned messages' : 'No messages yet'}</h2></div> : items().map(message => <button type="button" class={`message-item ${!message.isRead ? 'unread' : ''}`} aria-pressed={selectedId() === message.id} disabled={busy()} onClick={() => open(message)}>
          <div class="message-meta"><span>{categories[message.category] || 'Message'}</span>{message.isPinned && <Pin size={14}/>}<span class="message-time">{new Date(message.createdAt).toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric' })}</span></div>
          <h2>{message.title}</h2><p>{message.content}</p>{!message.isRead && <span class="message-unread">Unread</span>}
        </button>)}</div>
        <section class="message-detail" aria-label="Message details">{selected() ? <>
          <header class="detail-header"><button class="inbox-command" onClick={() => { setSelectedId(null); document.querySelector<HTMLButtonElement>('.message-item[aria-pressed="true"]')?.focus(); }}><ArrowLeft size={16}/>Back</button><button class="inbox-command" disabled={busy()} aria-pressed={selected().isPinned} title={selected().isPinned ? 'Unpin message' : 'Pin message'} aria-label={selected().isPinned ? 'Unpin message' : 'Pin message'} onClick={() => mutate(async () => {
                const isPinned = await inboxApi.togglePin(selected().id, userId());
                setMessages(prev => prev.map(message => message.id === selected().id ? { ...message, isPinned } : message));
            })}><Pin size={18}/></button></header>
          <div class="detail-content"><span class="detail-category">{categories[selected().category] || 'Message'}</span><h2 ref={_element => detailHeading.current = _element} tabIndex={-1}>{selected().title}</h2><time>{date(selected().createdAt)}</time><p class="detail-body">{selected().content}</p></div>
        </> : <div class="inbox-state"><Inbox size={28}/><p>No message selected</p></div>}</section>
      </div>
    </div>
  </main></div></>;
}
