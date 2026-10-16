import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, RotateCcw, CalendarDays, Clock, Video } from 'lucide-preact';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import ProfileAvatar from '../Components/Common/ProfileAvatar';
import { useAuthContext } from '../context/AuthContext';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { scheduleApi } from '../api/schedule.api';
import { getTicketBalance } from '../services/ticket.service';
import { favoritesApi } from '../api/favorites.api';
import './HomePage.css';

const loadActivity = () => scheduleApi.getStudentActivity(50);
const loadFavorites = () => favoritesApi.getFavorites(1, 4);
const ACTIVITY_PER_PAGE = 5;

// Sections retry independently; late responses cannot replace newer data.
function useHomeResource<T>(load: () => Promise<T>, enabled: boolean, owner: string | undefined) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    setError(false);
    if (!enabled) { setData(null); setLoading(false); return; }
    setLoading(true);
    try {
      const result = await load();
      if (id === request.current) setData(result);
    } catch {
      if (id === request.current) setError(true);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [load, enabled, owner]);
  useEffect(() => {
    setData(null);
    void reload();
    return () => { request.current++; };
  }, [reload]);
  return { data, loading, error, reload };
}

function HomeArt({ name }: { name: string }) {
  return <img className="student-home-art" src={`/assets/img/home-icons/${name}-v1.webp`} width={48} height={48} alt="" aria-hidden="true" />;
}

function ResourceState({ loading, error, retry, label }: { loading: boolean; error: boolean; retry: () => void; label: string }) {
  if (loading) return <div className="student-home-loading" role="status" aria-label={`Loading ${label}`}><span /><span /></div>;
  if (error) return <div className="student-home-error" role="alert"><p>{label} could not be loaded.</p><button className="student-home-link" onClick={retry}><RotateCcw size={15} />Try again</button></div>;
  return null;
}

function lessonMoment(date: string, time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  const moment = new Date(`${date}T${String(hour).padStart(2, '0')}:${match[2]}:00+08:00`);
  return Number.isNaN(moment.getTime()) ? null : moment;
}

function startsIn(moment: Date, now: number) {
  const minutes = Math.ceil((moment.getTime() - now) / 60000);
  if (minutes <= 0) return 'Started';
  if (minutes < 60) return `Starts in ${minutes} min`;
  if (minutes < 1440) return `Starts in ${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
  return `In ${Math.floor(minutes / 1440)} ${minutes < 2880 ? 'day' : 'days'}`;
}

const HomePage = () => {
  const { user } = useAuthContext();
  const now = useCurrentTime();
  const stats = useHomeResource(scheduleApi.getStudentStats, !!user, user?.userId);
  const activity = useHomeResource(loadActivity, !!user, user?.userId);
  const favorites = useHomeResource(loadFavorites, !!user, user?.userId);
  const wallet = user?.walletAddress || user?.smartWalletAddress;
  const loadTickets = useCallback(() => getTicketBalance(wallet!, { throwOnError: true }), [wallet]);
  const tickets = useHomeResource(loadTickets, !!wallet, user?.userId);
  const [activityPage, setActivityPage] = useState(1);
  const next = stats.data?.nextLesson;
  const moment = next ? lessonMoment(next.slotDate, next.slotTime) : null;
  const recent = activity.data || [];
  const pageCount = Math.max(1, Math.ceil(recent.length / ACTIVITY_PER_PAGE));
  const currentPage = Math.min(activityPage, pageCount);
  const displayName = user?.givenName || user?.familyName || 'Student';
  useEffect(() => { document.title = 'Home | FluentXVerse'; }, []);

  return <>
    <SideBar />
    <div className="student-home">
      <Header />
      <main className="student-home-main">
        <div className="student-home-container">
          <div className="student-home-heading"><HomeArt name="home" /><div><span className="student-home-eyebrow">Your learning space</span><h1>Welcome back, {displayName}</h1></div><a href="/browse-tutors" className="student-home-button"><CalendarDays size={17} />Book a Lesson</a></div>
          <section className="student-home-overview" aria-label="Lesson overview" aria-busy={stats.loading}>
            {[
              { art: 'training', label: 'Lessons completed', value: stats.data?.lessonsCompleted },
              { art: 'schedule', label: 'Upcoming lessons', value: stats.data?.upcomingLessons },
              { art: 'growth', label: 'Learning hours', value: stats.data?.totalHours },
            ].map(item => <div className="student-home-metric" key={item.label}><HomeArt name={item.art} /><div><span>{item.label}</span><strong>{stats.loading ? '…' : stats.error || item.value == null ? '—' : item.value.toLocaleString()}</strong></div></div>)}
          </section>
          <div className="student-home-primary-grid">
            <section className="student-home-card student-home-next" aria-labelledby="student-home-next-title">
              <div className="student-home-section-heading"><HomeArt name="schedule" /><h2 id="student-home-next-title">Next lesson</h2><a className="student-home-link" href="/schedule">My Schedule <ArrowUpRight size={16} /></a></div>
              <ResourceState loading={stats.loading} error={stats.error} retry={stats.reload} label="Your schedule" />
              {!stats.loading && !stats.error && (next ? <>
                <div className="student-home-lesson-person"><ProfileAvatar src={next.tutorAvatar} alt={next.tutorName} className="student-home-avatar" fallbackClassName="student-home-avatar-fallback" fallback={next.tutorName.charAt(0)} /><div><span className="student-home-eyebrow">Your tutor</span><h3>{next.tutorName}</h3>{moment && <span className="student-home-countdown">{startsIn(moment, now)}</span>}</div></div>
                <div className="student-home-lesson-details"><span><CalendarDays size={16} />{moment ? moment.toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo', weekday: 'short', month: 'short', day: 'numeric' }) : next.slotDate}</span><span><Clock size={16} />{moment ? `${moment.toLocaleTimeString('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', minute: '2-digit' })} JST` : next.slotTime}</span></div>
                <div className="student-home-lesson-footer"><span>Confirmed lesson</span><a className="student-home-button" href={`/lesson/${encodeURIComponent(next.bookingId)}`}><Video size={16} />Open Lesson <ArrowRight size={16} /></a></div>
              </> : <div className="student-home-empty student-home-empty-next"><HomeArt name="community" /><div><h3>Your next conversation starts here</h3><p>No upcoming lessons yet.</p><a className="student-home-link" href="/browse-tutors">Find a Tutor <ArrowRight size={16} /></a></div></div>)}
            </section>
            <section className="student-home-card student-home-tickets" aria-labelledby="student-home-tickets-title">
              <div className="student-home-section-heading"><HomeArt name="pay" /><h2 id="student-home-tickets-title">My tickets</h2></div>
              <ResourceState loading={tickets.loading} error={tickets.error} retry={tickets.reload} label="Your tickets" />
              {!tickets.loading && !tickets.error && (tickets.data ? <div className="student-home-ticket-list">{(['basic', 'premium', 'trial'] as const).filter(tier => tier !== 'trial' || tickets.data!.trial > 0).map(tier => <div className="student-home-ticket-row" key={tier}><img src={tier === 'trial' ? '/assets/img/icons/trial_ticket.webp' : `/assets/img/home-icons/${tier}-ticket-v2.png`} width={64} height={40} alt="" /><span>{tier[0].toUpperCase() + tier.slice(1)} tickets</span><strong>{tickets.data![tier]}</strong></div>)}</div> : <p className="student-home-muted">Your ticket balance is available on the tickets page.</p>)}
              <a className="student-home-button student-home-button-secondary student-home-ticket-button" href="/tickets">Get Tickets <ArrowRight size={16} /></a>
            </section>
          </div>
          <nav className="student-home-shortcuts" aria-label="Learning shortcuts">
            {[
              { href: '/browse-tutors', art: 'community', title: 'Find your tutor', detail: 'Browse tutors' },
              { href: '/materials', art: 'training', title: 'Explore materials', detail: 'Your lesson library' },
              { href: '/schedule?tab=past', art: 'growth', title: 'Review your lessons', detail: 'Notes & feedback' },
            ].map(item => <a key={item.href} href={item.href}><HomeArt name={item.art} /><div><strong>{item.title}</strong><span>{item.detail}</span></div><ArrowUpRight size={18} /></a>)}
          </nav>
          <div className="student-home-secondary-grid">
            <section className="student-home-favorites" aria-labelledby="student-home-favorites-title">
              <div className="student-home-section-heading"><HomeArt name="community" /><h2 id="student-home-favorites-title">Favorite tutors</h2><a className="student-home-link" href="/browse-tutors">Browse <ArrowUpRight size={16} /></a></div>
              <ResourceState loading={favorites.loading} error={favorites.error} retry={favorites.reload} label="Favorite tutors" />
              {!favorites.loading && !favorites.error && (favorites.data?.favorites.length ? <div className="student-home-favorite-list">{favorites.data.favorites.map(tutor => <a className="student-home-favorite" key={tutor.id} href={`/tutor/${encodeURIComponent(tutor.tutorId)}`}><ProfileAvatar src={tutor.tutorAvatar} alt={tutor.tutorName} className="student-home-avatar" fallbackClassName="student-home-avatar-fallback" fallback={tutor.tutorName.charAt(0)} /><div><strong>{tutor.tutorName}</strong><span>View profile & schedule</span></div><ArrowRight size={17} /></a>)}</div> : <div className="student-home-empty"><HomeArt name="community" /><div><h3>No favorites yet</h3><p>Find a tutor you’d like to learn with again.</p><a className="student-home-link" href="/browse-tutors">Browse Tutors <ArrowRight size={16} /></a></div></div>)}
            </section>
            <section className="student-home-activity" aria-labelledby="student-home-activity-title">
              <div className="student-home-section-heading"><HomeArt name="growth" /><h2 id="student-home-activity-title">Recent activity</h2></div>
              <ResourceState loading={activity.loading} error={activity.error} retry={activity.reload} label="Recent activity" />
              {!activity.loading && !activity.error && (recent.length ? <>
                <ul className="student-home-activity-list">{recent.slice((currentPage - 1) * ACTIVITY_PER_PAGE, currentPage * ACTIVITY_PER_PAGE).map((item, index) => <li key={`${item.type}-${item.bookingId || item.purchaseId || index}`}><HomeArt name={item.type === 'ticket_purchased' ? 'pay' : item.type === 'lesson_completed' ? 'training' : 'schedule'} /><div><strong>{item.action}</strong>{item.tutorName && <span>with {item.tutorName}</span>}<span className="student-home-activity-date">{item.date}</span></div>{item.bookingId && <a className="student-home-icon-button" href={`/lesson/${encodeURIComponent(item.bookingId)}`} aria-label={`View lesson ${item.tutorName ? `with ${item.tutorName}` : ''}, ${item.date}`} title="View lesson"><ArrowRight size={17} /></a>}</li>)}</ul>
                {pageCount > 1 && <div className="student-home-pagination"><span>{currentPage} of {pageCount}</span><button className="student-home-icon-button" disabled={currentPage === 1} onClick={() => setActivityPage(currentPage - 1)} aria-label="Previous activity page" title="Previous page"><ChevronLeft size={18} /></button><button className="student-home-icon-button" disabled={currentPage === pageCount} onClick={() => setActivityPage(currentPage + 1)} aria-label="Next activity page" title="Next page"><ChevronRight size={18} /></button></div>}
              </> : <div className="student-home-empty"><HomeArt name="growth" /><div><h3>A fresh start</h3><p>Your lessons and ticket purchases will appear here.</p></div></div>)}
            </section>
          </div>
        </div>
      </main>
    </div>
  </>;
};

export default HomePage;
