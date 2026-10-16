import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorArt from "../Components/Common/TutorArt";
import TutorIcon from "../Components/Common/TutorIcon";
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SideBar from '../Components/IndexOne/SideBar';
import { inboxApi, SystemMessage, MessageCategory } from '../api/inbox.api';
import { useAuthContext } from '../context/AuthContext';
import './InboxPage.css';
const categoryInfo = {
    announcement: { icon: 'fa-bullhorn', color: '#0245ae', label: 'Announcement' },
    update: { icon: 'fa-rocket', color: '#10b981', label: 'Update' },
    alert: { icon: 'fa-exclamation-triangle', color: '#f59e0b', label: 'Alert' },
    news: { icon: 'fa-newspaper', color: '#8b5cf6', label: 'News' },
    promotion: { icon: 'fa-gift', color: '#ec4899', label: 'Promotion' }
};
export default function InboxPage() {
    const _state0 = useAuthContext();
    // Set page title for browser tab
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            const prevTitle = document.title;
            document.title = 'Inbox | FluentXVerse';
            return () => {
                document.title = prevTitle;
            };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    const [messages, setMessages] = createSignal<SystemMessage[]>([]);
    const [selectedMessage, setSelectedMessage] = createSignal<SystemMessage | null>(null);
    const [filter, setFilter] = createSignal<'all' | 'unread' | 'pinned'>('all');
    const [isLoading, setIsLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);
    const userId = createMemo(() => _state0.user?.userId || localStorage.getItem('fxv_user_id') || '');
    createEffect(on(() => [filter(), userId(), _state0.initialLoading], () => {
        const _cleanup2 = untrack(() => {
            if (_state0.initialLoading)
                return;
            loadMessages();
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const loadMessages = async () => {
        if (_state0.initialLoading) {
            return;
        }
        if (!userId()) {
            setError('Please log in to view your inbox');
            setMessages([]);
            setSelectedMessage(null);
            setIsLoading(false);
            return;
        }
        try {
            setIsLoading(true);
            setError(null);
            const params: any = { get userId() {
                    return userId();
                } };
            if (filter() === 'unread')
                params.isRead = false;
            if (filter() === 'pinned')
                params.isPinned = true;
            const response = await inboxApi.getMessages(params);
            const nextMessages = response.messages || [];
            setMessages(nextMessages);
            setSelectedMessage((current) => current ? nextMessages.find((message) => message.id === current.id) || null : null);
        }
        catch (err: any) {
            console.error('Failed to load messages:', err);
            setError(err?.message || 'Failed to load messages');
        }
        finally {
            setIsLoading(false);
        }
    };
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
        else if (days === 1) {
            return 'Yesterday';
        }
        else if (days < 7) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        }
        else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };
    const markAsRead = async (messageId: string) => {
        try {
            await inboxApi.markAsRead(messageId, userId());
            setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, isRead: true } : msg));
        }
        catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };
    const markAllAsRead = async () => {
        try {
            await inboxApi.markAllAsRead(userId());
            setMessages(prev => prev.map(msg => ({ ...msg, isRead: true })));
        }
        catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };
    const togglePin = async (messageId: string) => {
        try {
            const isPinned = await inboxApi.togglePin(messageId, userId());
            setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, isPinned } : msg));
            if (selectedMessage()?.id === messageId) {
                setSelectedMessage({ ...selectedMessage(), isPinned });
            }
        }
        catch (err) {
            console.error('Failed to toggle pin:', err);
        }
    };
    const handleMessageClick = (message: SystemMessage) => {
        setSelectedMessage(message);
        if (!message.isRead) {
            markAsRead(message.id);
        }
    };
    // Sort messages: pinned first, then by date
    const sortedMessages = createMemo(() => [...messages()].sort((a, b) => {
        if (a.isPinned && !b.isPinned)
            return -1;
        if (!a.isPinned && b.isPinned)
            return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }));
    const unreadCount = createMemo(() => messages().filter(m => !m.isRead).length);
    return (<>
      <SideBar />
      <div class="inbox-page main-content">
        <DashboardHeader />
        
        <div class="inbox-container">
        <div class="inbox-header">
          <div class="inbox-header-content">
            <div class="inbox-icon-wrapper">
              <TutorArt name="community" size={48}/>
            </div>
            <div>
              <h1>Inbox</h1>
              <p>Messages from FluentXVerse</p>
            </div>
          </div>
          {unreadCount() > 0 && (<button class="mark-all-read-btn" onClick={markAllAsRead}>
              <TutorIcon name="fas fa-check-double"/>
              Mark all as read
            </button>)}
        </div>

        <div class="inbox-error-slot" aria-live="polite">
          {error() && (<div class="inbox-error">
              <TutorIcon name="fas fa-exclamation-circle"/>
              <p>{error()}</p>
              <button onClick={loadMessages}>Try Again</button>
            </div>)}
        </div>

        <div class="inbox-filters">
          <button class={`filter-btn ${filter() === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            <TutorIcon name="fas fa-inbox"/>
            All Messages
            <span class="filter-count">{messages().length}</span>
          </button>
          <button class={`filter-btn ${filter() === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>
            <TutorIcon name="fas fa-envelope"/>
            Unread
            {unreadCount() > 0 && <span class="filter-count unread">{unreadCount()}</span>}
          </button>
          <button class={`filter-btn ${filter() === 'pinned' ? 'active' : ''}`} onClick={() => setFilter('pinned')}>
            <TutorIcon name="fas fa-thumbtack"/>
            Pinned
          </button>
        </div>

        <div class="inbox-content">
          <div class="messages-list">
            {isLoading() ? (<div class="inbox-loading">
                <TutorIcon name="fas fa-spinner fa-spin"/>
                <p>Loading messages...</p>
              </div>) : sortedMessages().length === 0 ? (<div class="inbox-empty">
                <TutorIcon name="fas fa-inbox"/>
                <p>No messages</p>
                <span>
                  {filter() === 'unread' ? 'All caught up!' :
                filter() === 'pinned' ? 'No pinned messages' :
                    'Your inbox is empty'}
                </span>
              </div>) : (sortedMessages().map(message => {
            const catInfo = categoryInfo[message.category];
            return (<div class={`message-item ${!message.isRead ? 'unread' : ''} ${selectedMessage()?.id === message.id ? 'selected' : ''}`} onClick={() => handleMessageClick(message)}>
                    <div class="message-icon" style={cssStyle({ backgroundColor: `${catInfo.color}15`, color: catInfo.color })}>
                      <TutorIcon name={`fas ${catInfo.icon}`}/>
                    </div>
                    <div class="message-preview">
                      <div class="message-header">
                        <h4 class="message-title">{message.title}</h4>
                        <span class="message-time">{formatDate(message.createdAt)}</span>
                      </div>
                      <p class="message-snippet">{message.content}</p>
                      <div class="message-meta">
                        <span class="message-category" style={cssStyle({ backgroundColor: `${catInfo.color}15`, color: catInfo.color })}>
                          {catInfo.label}
                        </span>
                        {message.isPinned && (<span class="message-pinned">
                            <TutorIcon name="fas fa-thumbtack"/>
                          </span>)}
                      </div>
                    </div>
                    {!message.isRead && <div class="unread-dot"></div>}
                  </div>);
        }))}
          </div>

          <div class={`message-detail ${selectedMessage() ? 'visible' : ''}`}>
            {selectedMessage() ? (<>
                <div class="detail-header">
                  <button class="back-btn" onClick={() => setSelectedMessage(null)}>
                    <TutorIcon name="fas fa-arrow-left"/>
                  </button>
                  <div class="detail-actions">
                    <button class={`inbox-action-btn ${selectedMessage().isPinned ? 'active' : ''}`} onClick={() => togglePin(selectedMessage().id)} title={selectedMessage().isPinned ? 'Unpin' : 'Pin'}>
                      <TutorIcon name="fas fa-thumbtack"/>
                    </button>
                  </div>
                </div>
                <div class="detail-content">
                  <div class="detail-category" style={cssStyle({ get backgroundColor() {
                    return `${categoryInfo[selectedMessage().category].color}15`;
                }, get color() {
                    return categoryInfo[selectedMessage().category].color;
                } })}>
                    <TutorIcon name={`fas ${categoryInfo[selectedMessage().category].icon}`}/>
                    {categoryInfo[selectedMessage().category].label}
                  </div>
                  <h2 class="detail-title">{selectedMessage().title}</h2>
                  <span class="detail-date">
                    {new Date(selectedMessage().createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}
                  </span>
                  <div class="detail-body">
                    <p>{selectedMessage().content}</p>
                  </div>
                </div>
              </>) : (<div class="no-message-selected">
                <TutorIcon name="fas fa-envelope-open-text"/>
                <p>Select a message to read</p>
              </div>)}
          </div>
        </div>
      </div>
    </div>
    </>);
}
