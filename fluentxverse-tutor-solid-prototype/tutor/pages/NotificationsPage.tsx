import { createEffect, createSignal, For, on, onCleanup } from 'solid-js';
import { Bell, CalendarPlus, CalendarX, ClipboardList, Check, CheckCheck, Trash2, RefreshCw, ChevronDown, ArrowUpRight } from 'lucide-solid';
import TutorArt from '../Components/Common/TutorArt';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import { useAuthContext } from '../context/AuthContext';
import { useNotificationStore } from '../context/NotificationContext';
import { formatRelativeTime } from '../hooks/useNotifications';
import { notificationLink } from '../utils/notificationLink';
import { notificationApi } from '../api/notification.api';
import type { Notification } from '../types/notification.types';
import './NotificationsPage.css';

const category = (item: Notification) => /lesson notes/i.test(item.title) ? {label:'Lesson notes',Icon:ClipboardList,tone:'amber'} : item.type === 'booking_new' ? {label:'Booking',Icon:CalendarPlus,tone:'green'} : item.type === 'booking_cancelled' ? {label:'Cancellation',Icon:CalendarX,tone:'rose'} : {label:'Update',Icon:Bell,tone:'blue'};
const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const groupFor = (value: string) => {
 const date=new Date(value),now=new Date();
 if(!Number.isFinite(date.getTime()))return 'Earlier';
 return dayKey(date)===dayKey(now)?'Today':dayKey(date)===dayKey(new Date(now.getTime()-86400000))?'Yesterday':'Earlier';
};
const fullTime = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-US',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})+' PHT' : 'Date unavailable';

export default function NotificationsPage(){
 const auth=useAuthContext(),store=useNotificationStore();
 const [items,setItems]=createSignal<Notification[]>([]),[unread,setUnread]=createSignal(false),[loading,setLoading]=createSignal(true),[more,setMore]=createSignal(false),[error,setError]=createSignal(''),[action,setAction]=createSignal('');
 let offset=0,request=0,disposed=false,retryMore=false;
 onCleanup(()=>{disposed=true;request++;});
 const load=async(append=false)=>{
  const version=++request,owner=auth.user?.userId;
  setLoading(true);setError('');retryMore=append;
  try{
   const data=await notificationApi.getNotifications(20,append?offset:0,unread()?false:undefined);
   if(disposed||version!==request||auth.user?.userId!==owner)return;
   offset=(append?offset:0)+data.notifications.length;
   setItems(previous=>[...new Map([...(append?previous:[]),...data.notifications].map(item=>[item.id,item])).values()]);
   setMore(data.notifications.length===20);store.setUnreadCount(data.unreadCount);
  }catch{if(!disposed&&version===request)setError('Could not load notifications. Please try again.');}
  finally{if(!disposed&&version===request)setLoading(false);}
 };
 createEffect(on(()=>auth.user?.userId,id=>{document.title='Notifications | FluentXVerse';setItems([]);offset=0;if(id)void load();else{request++;setLoading(false);}}));
 createEffect(on(()=>store.notifications,latest=>{
  const updates=new Map(latest.map(item=>[item.id,item]));
  setItems(previous=>previous.map(item=>updates.get(item.id)||item));
 }));
 const visible=()=>items().filter(item=>!unread()||!item.isRead);
 const mutate=async(kind:'read'|'delete'|'all',item?:Notification)=>{
  if(action()||loading())return;
  const owner=auth.user?.userId;setAction(kind==='all'?'all':item!.id);setError('');
  try{
   if(kind==='all')await notificationApi.markAllAsRead();else if(kind==='delete')await notificationApi.deleteNotification(item!.id);else await notificationApi.markAsRead(item!.id);
   if(disposed||auth.user?.userId!==owner)return;
   if(kind==='delete'||(kind==='read'&&unread()))offset=Math.max(0,offset-1);
   if(kind==='all'&&unread()){setMore(false);offset=0;}
   const update=(list:Notification[])=>kind==='delete'?list.filter(n=>n.id!==item!.id):list.map(n=>kind==='all'||n.id===item!.id?{...n,isRead:true}:n);
   setItems(update);
   useNotificationStore.setState(state=>({notifications:update(state.notifications),unreadCount:kind==='all'?0:Math.max(0,state.unreadCount-(item?.isRead?0:1))}));
  }catch{if(!disposed&&auth.user?.userId===owner)setError('Could not update this notification. Please try the action again.');}
  finally{if(!disposed)setAction('');}
 };
 return <><SideBar/><div class="main-content"><DashboardHeader user={auth.user||undefined}/>
 <main class="notifications-page notification-inbox">
  <header class="ni-heading"><div class="ni-title"><TutorArt name="notifications" size={44}/><div><h1>Notifications</h1><p>{store.unreadCount?`${store.unreadCount} unread notifications`:'All caught up'}</p></div></div>
   <button class="ni-command" disabled={!store.unreadCount||!!action()||loading()} onClick={()=>void mutate('all')}><CheckCheck size={17}/>{action()==='all'?'Marking as read...':'Mark all as read'}</button>
  </header>
  <div class="ni-toolbar"><div class="ni-filters" role="group" aria-label="Notification filter"><For each={[false,true]}>{value=><button disabled={!!action()} aria-pressed={unread()===value} onClick={()=>{if(unread()===value)return;setUnread(value);setItems([]);void load();}}>{value?'Unread':'All'}{value&&store.unreadCount>0&&<span>{store.unreadCount}</span>}</button>}</For></div>
   <button class="ni-icon" title="Refresh notifications" aria-label="Refresh notifications" disabled={loading()||!!action()} onClick={()=>void load()}><RefreshCw size={17}/></button>
  </div>
  {error()&&<div class="ni-error" role="alert"><span>{error()}</span>{error().startsWith('Could not load')&&<button onClick={()=>void load(retryMore)}>Try again</button>}</div>}
  <div class="ni-feed" aria-busy={loading()}>
   {error()&&!items().length?<div class="ni-state"><h2>Notifications unavailable</h2></div>:loading()&&!items().length?<div class="ni-state" role="status">Loading notifications...</div>:!visible().length?<div class="ni-state"><Bell size={28}/><h2>{unread()?'No unread notifications':'No notifications yet'}</h2><p>{unread()?'You are all caught up.':'New updates will appear here.'}</p></div>:<For each={['Today','Yesterday','Earlier']}>{group=>{
    const grouped=()=>visible().filter(item=>groupFor(item.timestamp)===group);
    return <>{grouped().length>0&&<section aria-label={group}><h2 class="ni-day">{group}</h2><ul><For each={grouped()}>{item=>{
     const style=category(item),link=notificationLink(item);
     return <li class="ni-row" classList={{'ni-unread':!item.isRead}}>
      <div class={`ni-type ni-${style.tone}`} title={style.label}><style.Icon size={19}/></div>
      <div class="ni-content"><div class="ni-meta"><span>{style.label}</span>{!item.isRead&&<span class="ni-unread-label">Unread</span>}</div>
       {link?<a class="ni-link" href={link} onClick={()=>{if(!item.isRead)void mutate('read',item);}}>{item.title}<ArrowUpRight size={14}/></a>:<h3>{item.title}</h3>}
       <p>{item.message}</p><time dateTime={item.timestamp} title={fullTime(item.timestamp)}>{Number.isFinite(Date.parse(item.timestamp))?formatRelativeTime(item.timestamp):'Date unavailable'}<span> · {fullTime(item.timestamp)}</span></time>
      </div><div class="ni-actions">{!item.isRead&&<button class="ni-icon" title="Mark as read" aria-label={`Mark as read: ${item.title}`} disabled={!!action()||loading()} onClick={()=>void mutate('read',item)}><Check size={16}/></button>}
       <button class="ni-icon ni-delete" title="Delete notification" aria-label={`Delete: ${item.title}`} disabled={!!action()||loading()} onClick={()=>void mutate('delete',item)}><Trash2 size={16}/></button>
      </div></li>;
    }}</For></ul></section>}</>;
   }}</For>}
  </div>
  {more()&&<footer class="ni-footer"><button class="ni-command" disabled={loading()||!!action()} onClick={()=>void load(true)}><ChevronDown size={17}/>{loading()?'Loading...':'Load more'}</button></footer>}
 </main></div></>;
}
