import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import StudentDialog from '../Common/StudentDialog';
import { Bell, X, RotateCw } from "lucide-solid";
import { client } from '../../api/utils';
import { useAuthContext } from '../../context/AuthContext';
import { createNotificationRefresh } from '../../utils/notificationRefresh';
import { fetchNotificationFeed, type LessonNotice } from '../../utils/notificationFeed';
import './LessonNotifications.css';
export default function LessonNotifications() {
    const [items, setItems] = createSignal<LessonNotice[]>([]);
    const [error, setError] = createSignal('');
    const [loading, setLoading] = createSignal(false);
    const [loaded, setLoaded] = createSignal(false);
    const [open, setOpen] = createSignal(false);
    const _state0 = useAuthContext();
    const refresh = { current: undefined } as {
        current: ((force?: boolean) => Promise<void>) | null;
    };
    const load = (force = false) => { void refresh.current?.(force).catch(() => { }); };
    createEffect(on(() => _state0.user?.userId, () => {
        const _cleanup1 = untrack(() => {
            setItems([]);
            setError('');
            setLoaded(false);
            setLoading(false);
            if (!_state0.user?.userId)
                return;
            let active = true;
            const controller = new AbortController();
            refresh.current = createNotificationRefresh(async () => {
                if (active) { setLoading(true); setError(''); }
                try {
                    const notifications = await fetchNotificationFeed(
                        () => client.get('/notifications/', { params: { limit: 20 }, signal: controller.signal, timeout: 10000 }),
                        controller.signal,
                    );
                    if (active) {
                        setItems(notifications);
                        setLoaded(true);
                        setError('');
                    }
                }
                catch (error) {
                    if (active)
                        setError('Could not load notifications.');
                    throw error;
                }
                finally { if (active) setLoading(false); }
            });
            load();
            const timer = window.setInterval(() => { if (!document.hidden)
                load(); }, 30000);
            const focus = () => { if (!document.hidden)
                load(); };
            const online = () => { void refresh.current?.(true).catch(() => { }); };
            window.addEventListener('focus', focus);
            window.addEventListener('online', online);
            return () => {
                active = false;
                controller.abort();
                refresh.current = undefined;
                window.clearInterval(timer);
                window.removeEventListener('focus', focus);
                window.removeEventListener('online', online);
            };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [open()], () => {
        const _cleanup2 = untrack(() => { if (open())
            load(true); });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const unread = createMemo(() => items().filter(item => !item.isRead).length);
    return <><button type="button" class="student-notification-bell" title="Notifications" aria-label={`Notifications${unread() ? `, ${unread()} unread` : ''}`} onClick={() => setOpen(true)}><Bell size={19}/>{unread() > 0 && <span>{unread()}</span>}</button>
    {open() && <StudentDialog className="student-notification-dialog" label="Notifications" onClose={() => setOpen(false)}><header><img src="/assets/img/home-icons/notifications-v1.webp" alt="" width="40" height="40"/><h2>Notifications</h2><button type="button" title="Close notifications" aria-label="Close notifications" onClick={() => setOpen(false)}><X size={18}/></button></header>
      {error() && <p class="student-notification-status" role="alert">{loaded() ? 'Could not refresh notifications. Showing the last update.' : error()}<button type="button" onClick={() => load(true)}><RotateCw size={16}/>Retry</button></p>}
      {loading() && <p class="student-notification-status" role="status">{loaded() ? 'Refreshing notifications...' : 'Loading notifications...'}</p>}
      {loaded() && !loading() && !error() && !items().length && <p>No notifications yet.</p>}
      <div aria-busy={loading()}>{items().map(item => <a class={item.isRead ? 'is-read' : ''} href={item.data?.link?.startsWith('/lesson/') ? item.data.link : '/schedule'} onClick={() => {
          void client.post(`/notifications/${encodeURIComponent(item.id)}/read`).then(({ data }) => {
              if (data.success) setItems(previous => previous.map(notice => notice.id === item.id ? { ...notice, isRead: true } : notice));
          }).catch(() => { });
      }}><strong>{item.title}</strong><span>{item.message}</span><time dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString()}</time></a>)}</div>
    </StudentDialog>}</>;
}
