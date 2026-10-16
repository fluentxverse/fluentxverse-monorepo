import { useEffect, useRef, useState } from 'preact/hooks';
import { ArrowLeft, CheckCheck, CircleAlert, Inbox, Mail, Pin, RotateCw } from 'lucide-preact';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { inboxApi, type SystemMessage } from '../api/inbox.api';
import './InboxPage.css';

const categories = { announcement: 'Announcement', update: 'Update', alert: 'Alert', news: 'News', promotion: 'Promotion' };
export default function InboxPage() {
  const { user } = useAuthContext();
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'pinned'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const revision = useRef(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const userId = user?.userId || '';
  const load = async () => {
    const request = ++revision.current;
    if (!userId) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const result = await inboxApi.getMessages({ userId });
      if (request === revision.current) setMessages(result.messages);
    } catch (err) {
      if (request === revision.current) setError(err instanceof Error ? err.message : 'Could not load messages.');
    } finally { if (request === revision.current) setLoading(false); }
  };
  useEffect(() => { document.title = 'Inbox | FluentXVerse'; load(); return () => { revision.current++; }; }, [userId]);
  useEffect(() => { if (selectedId) detailHeading.current?.focus(); }, [selectedId]);
  const mutate = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update your inbox. Please try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const open = async (message: SystemMessage) => {
    setSelectedId(message.id);
    if (!message.isRead) await mutate(async () => {
      await inboxApi.markAsRead(message.id, userId);
      setMessages(prev => prev.map(item => item.id === message.id ? { ...item, isRead: true } : item));
    });
  };
  const selected = messages.find(message => message.id === selectedId);
  const unread = messages.filter(message => !message.isRead).length;
  const items = messages.filter(message => filter === 'all' || (filter === 'unread' ? !message.isRead : message.isPinned))
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const date = (value: string) => new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' JST';
  return <><SideBar /><div className="student-inbox-shell"><Header /><main className="inbox-page">
    <div className="inbox-container">
      <header className="inbox-header"><div className="inbox-heading"><img src="/assets/img/home-icons/community-v1.webp" alt="" width="48" height="48" /><div><h1>Inbox</h1><p>{unread} unread messages</p></div></div>
        <button className="inbox-command" disabled={!unread || busy || loading} onClick={() => mutate(async () => {
          await inboxApi.markAllAsRead(userId); setMessages(prev => prev.map(message => ({ ...message, isRead: true })));
        })}><CheckCheck size={18} />Mark all as read</button>
      </header>
      {error && <div className="inbox-error" role="alert"><CircleAlert size={18} /><span>{error}</span><button className="inbox-command" disabled={busy} onClick={load}><RotateCw size={16} />Reload</button></div>}
      <nav className="inbox-filters" aria-label="Message filters">{(['all', 'unread', 'pinned'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setSelectedId(null); }}><span>{value === 'all' ? 'All messages' : value === 'unread' ? 'Unread' : 'Pinned'}</span></button>)}</nav>
      <div className={`inbox-content ${selected ? 'inbox-reading' : ''}`}>
        <div className="messages-list" aria-label="Messages">{loading ? <div className="inbox-state" role="status"><Mail size={24} /><p>Loading messages...</p></div> : !items.length ? <div className="inbox-state"><img src="/assets/img/home-icons/community-v1.webp" alt="" width="64" height="64" /><h2>{filter === 'unread' ? 'All caught up' : filter === 'pinned' ? 'No pinned messages' : 'No messages yet'}</h2></div> : items.map(message => <button type="button" key={message.id} className={`message-item ${!message.isRead ? 'unread' : ''}`} aria-pressed={selectedId === message.id} disabled={busy} onClick={() => open(message)}>
          <div className="message-meta"><span>{categories[message.category] || 'Message'}</span>{message.isPinned && <Pin size={14} />}<span className="message-time">{new Date(message.createdAt).toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric' })}</span></div>
          <h2>{message.title}</h2><p>{message.content}</p>{!message.isRead && <span className="message-unread">Unread</span>}
        </button>)}</div>
        <section className="message-detail" aria-label="Message details">{selected ? <>
          <header className="detail-header"><button className="inbox-command" onClick={() => { setSelectedId(null); document.querySelector<HTMLButtonElement>('.message-item[aria-pressed="true"]')?.focus(); }}><ArrowLeft size={16} />Back</button><button className="inbox-command" disabled={busy} aria-pressed={selected.isPinned} title={selected.isPinned ? 'Unpin message' : 'Pin message'} aria-label={selected.isPinned ? 'Unpin message' : 'Pin message'} onClick={() => mutate(async () => {
            const isPinned = await inboxApi.togglePin(selected.id, userId);
            setMessages(prev => prev.map(message => message.id === selected.id ? { ...message, isPinned } : message));
          })}><Pin size={18} /></button></header>
          <div className="detail-content"><span className="detail-category">{categories[selected.category] || 'Message'}</span><h2 ref={detailHeading} tabIndex={-1}>{selected.title}</h2><time>{date(selected.createdAt)}</time><p className="detail-body">{selected.content}</p></div>
        </> : <div className="inbox-state"><Inbox size={28} /><p>No message selected</p></div>}</section>
      </div>
    </div>
  </main></div></>;
}
