import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { Search, X, CalendarDays, SlidersHorizontal, ArrowRight, ArrowDown, RotateCcw, Star, ShieldCheck, MapPin, Languages, Video, Plus } from 'lucide-preact';
import { tutorApi } from '../api/tutor.api';
import type { Tutor } from '../types/tutor.types';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { BookingModal } from '../Components/Booking/BookingModal';
import ProfileAvatar from '../Components/Common/ProfileAvatar';
import { useAuthContext } from '../context/AuthContext';
import LoadingSpinner from '../Components/LoadingSpinner';
import { API_BASE_URL } from '../config/api';
import './BrowseTutorsPage.css';

const timeOptions = Array.from({ length: 38 }, (_, index) => `${String(5 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`).concat('24:30');
const timeLabel = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return `${String((hour + 1) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}${hour + 1 >= 24 ? ' (+1 day)' : ''}`;
};

// Search availability is keyed by Philippine operational dates on the server.
const operationalDate = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

function TutorCard({ tutor, onBook }: { tutor: Tutor; onBook: (tutor: Tutor) => void }) {
  const name = tutor.displayName || `${tutor.firstName} ${tutor.lastName}`;
  const profileUrl = `/tutor/${encodeURIComponent(tutor.userId)}`;
  const initials = `${tutor.firstName?.[0] || ''}${tutor.lastName?.[0] || ''}`.toUpperCase();
  const proofLabels = { local_proof_generated: 'ZK Proof Ready', submitted: 'zkVerify Pending', verified: 'ZK Verified' };
  const proofLabel = tutor.zkCertificationStatus && proofLabels[tutor.zkCertificationStatus as keyof typeof proofLabels];
  return (
    <article className="browse-tutor-card">
      <div className="browse-tutor-profile">
        <a href={profileUrl} aria-label={`View ${name}'s profile`} className="browse-tutor-avatar-link">
          <ProfileAvatar src={tutor.profilePicture} alt={name} className="browse-tutor-avatar" fallbackClassName="browse-tutor-avatar--fallback" fallback={initials} />
        </a>
        <div className="browse-tutor-info">
          {tutor.isAvailable && <span className="browse-available"><span />Open slots</span>}
          <h2><a href={profileUrl}>{name}</a></h2>
          <div className="browse-tutor-rating">
            {tutor.rating && (tutor.totalReviews || 0) > 0 ? <><Star size={15} fill="currentColor" /><strong>{tutor.rating.toFixed(1)}</strong><span>({tutor.totalReviews} reviews)</span></> : <span>No reviews yet</span>}
          </div>
        </div>
      </div>
      {(tutor.isVerified || proofLabel) && <div className="browse-tutor-credentials">
        {tutor.isVerified && <span><ShieldCheck size={14} />Verified</span>}
        {proofLabel && (tutor.zkCredentialCommitment ? <a href={`${API_BASE_URL}/proof/tutor-certification/public/${encodeURIComponent(tutor.zkCredentialCommitment)}`} target="_blank" rel="noreferrer"><ShieldCheck size={14} />{proofLabel}</a> : <span><ShieldCheck size={14} />{proofLabel}</span>)}
      </div>}
      {tutor.bio && <p className="browse-tutor-bio">{tutor.bio}</p>}
      <div className="browse-tutor-details">
        {tutor.languages?.length ? <span><Languages size={15} />{tutor.languages.slice(0, 3).join(', ')}</span> : null}
        {tutor.country && <span><MapPin size={15} />{tutor.country}</span>}
        {typeof tutor.totalSessions === 'number' && <span><Video size={15} />{tutor.totalSessions} lessons</span>}
      </div>
      {tutor.specializations?.length ? <div className="browse-tutor-tags">{tutor.specializations.slice(0, 3).map(spec => <span key={spec}>{spec}</span>)}</div> : null}
      <div className="browse-tutor-actions">
        <a href={profileUrl} className="browse-button browse-button--secondary">View Profile</a>
        <button className="browse-button" onClick={() => onBook(tutor)} aria-label={`Show schedule for ${name}`}><CalendarDays size={16} />Show Schedule</button>
      </div>
    </article>
  );
}

export const BrowseTutorsPage = () => {
  const { user, isAuthenticated, initialLoading } = useAuthContext();
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const pageRef = useRef(page);
  pageRef.current = page;
  const requestId = useRef(0);
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(operationalDate);
  const [startTime, setStartTime] = useState('05:00');
  const [endTime, setEndTime] = useState('24:30');
  const [showFilters, setShowFilters] = useState(false);
  const filterDialog = useRef<HTMLDialogElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [balance, setBalance] = useState<{ basic: number; premium: number; trial: number } | null>(null);

  const today = operationalDate();
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return { value: date.toISOString().slice(0, 10), label: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date), day: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date) };
  });
  const filtered = !!query || selectedDate !== today || startTime !== '05:00' || endTime !== '24:30';

  useEffect(() => {
    document.title = 'Browse Tutors | FluentXVerse';
    return () => { requestId.current++; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBalance(null);
    if (isAuthenticated && user?.walletAddress) {
      fetch(`${API_BASE_URL}/tickets/balance/${encodeURIComponent(user.walletAddress)}`)
        .then(response => response.ok ? response.json() : Promise.reject())
        .then(result => { if (!cancelled && result.success) setBalance(result.data); })
        .catch(() => { /* Ticket balance failure must not prevent browsing. */ });
    }
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.walletAddress]);

  useEffect(() => {
    if (!showFilters || !filterDialog.current) return;
    const dialog = filterDialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; filterButton.current?.focus(); };
  }, [showFilters]);

  const searchTutors = useCallback(async (reset = true) => {
    const id = ++requestId.current;
    const nextPage = reset ? 1 : pageRef.current + 1;
    setLoading(true);
    setError(null);
    if (reset) setTutors([]);
    try {
      const result = await tutorApi.searchTutors({ query: query || undefined, dateFilter: selectedDate, startTime: startTime === '05:00' ? undefined : startTime, endTime: endTime === '24:30' ? undefined : endTime, page: nextPage, limit: 12 });
      if (id !== requestId.current) return;
      setTutors(previous => reset ? result.tutors : [...previous, ...result.tutors.filter(tutor => !previous.some(existing => existing.userId === tutor.userId))]);
      setPage(nextPage);
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch {
      if (id === requestId.current) setError('Tutors could not be loaded. Please try again.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [query, selectedDate, startTime, endTime]);

  useEffect(() => { searchTutors(); }, [searchTutors]);

  const clearFilters = () => {
    setDraftQuery(''); setQuery(''); setSelectedDate(today); setStartTime('05:00'); setEndTime('24:30');
    if (!filtered) searchTutors();
  };

  const timeControls = (suffix: string) => <div className="browse-time-controls">
    <span className="browse-time-label">JST</span>
    <select aria-label={`Start time${suffix}`} value={startTime} onChange={e => setStartTime(e.currentTarget.value)}>
      {timeOptions.filter(time => time < endTime).map(time => <option key={time} value={time}>{timeLabel(time)}</option>)}
    </select>
    <span aria-hidden="true">–</span>
    <select aria-label={`End time${suffix}`} value={endTime} onChange={e => setEndTime(e.currentTarget.value)}>
      {timeOptions.filter(time => time > startTime).map(time => <option key={time} value={time}>{timeLabel(time)}</option>)}
    </select>
  </div>;

  if (initialLoading) return <div className="browse-auth-check"><LoadingSpinner /></div>;

  return <>
    {isAuthenticated && <SideBar />}
    <div className={`browse-page ${isAuthenticated ? 'browse-page--with-sidebar' : 'browse-page--public'}`}>
      <Header />
      <main className="browse-main">
        <div className="browse-container">
          <div className="browse-page-heading">
            <img src="/assets/img/browse/community-v1.webp" width={64} height={64} alt="" aria-hidden="true" />
            <div><h1>Browse Tutors</h1><p>English lessons, on your schedule.</p></div>
            {isAuthenticated && <a href="/tickets" className="browse-ticket-link"><Plus size={16} />Get Tickets</a>}
          </div>
          {isAuthenticated && <section className="browse-ticket-summary" aria-label="Your tickets">
            {balance ? (['trial', 'basic', 'premium'] as const).filter(tier => tier !== 'trial' || balance.trial > 0).map(tier => <span key={tier}><img src={tier === 'trial' ? '/assets/img/icons/trial_ticket.webp' : `/assets/img/home-icons/${tier}-ticket-v2.png`} width={48} height={30} alt="" /><strong>{balance[tier]}</strong>{tier[0].toUpperCase() + tier.slice(1)} tickets</span>) : <a href="/tickets">View ticket balance <ArrowRight size={14} /></a>}
          </section>}
          <div className="browse-search-toolbar">
            <form className="browse-search" role="search" onSubmit={e => { e.preventDefault(); const next = draftQuery.trim(); if (next === query) searchTutors(); else setQuery(next); }}>
              <Search size={18} aria-hidden="true" />
              <input aria-label="Search tutors by name" placeholder="Search tutor name" value={draftQuery} onInput={e => setDraftQuery(e.currentTarget.value)} />
              {draftQuery && <button type="button" className="browse-icon-button" aria-label="Clear search" title="Clear search" onClick={() => { setDraftQuery(''); setQuery(''); }}><X size={16} /></button>}
              <button className="browse-button" type="submit">Search</button>
            </form>
            <div className="browse-toolbar-time">{timeControls('')}</div>
            <button ref={filterButton} className="browse-button browse-button--secondary browse-filter-button" onClick={() => setShowFilters(true)} aria-haspopup="dialog"><SlidersHorizontal size={17} />Filters</button>
          </div>
          <div className="browse-day-strip" aria-label="Availability day">
            {dates.map(date => <button key={date.value} aria-pressed={selectedDate === date.value} onClick={() => setSelectedDate(date.value)}><strong>{date.label}</strong><span>{date.day}</span></button>)}
          </div>
          <div className="browse-results-header">
            <p role="status">{loading ? 'Finding tutors…' : `${tutors.length} of ${total} ${total === 1 ? 'tutor' : 'tutors'}`}</p>
            {filtered && <button className="browse-reset" onClick={clearFilters}><RotateCcw size={14} />Reset filters</button>}
          </div>
          {error && <div className="browse-error" role="alert"><p>{error}</p><button className="browse-button browse-button--secondary" onClick={() => searchTutors(tutors.length === 0)}><RotateCcw size={15} />Try Again</button></div>}
          <div className="browse-grid" aria-busy={loading}>
            {loading && tutors.length === 0 ? Array.from({ length: 6 }, (_, index) => <div className="browse-tutor-skeleton" key={index} aria-hidden="true"><span /><div /><div /></div>) : tutors.map(tutor => <TutorCard key={tutor.userId} tutor={tutor} onBook={setSelectedTutor} />)}
          </div>
          {!loading && !error && tutors.length === 0 && <div className="browse-empty"><Search size={32} /><h2>No matching tutors</h2><p>There are no open lessons for this search.</p><button className="browse-button browse-button--secondary" onClick={clearFilters}><RotateCcw size={16} />Reset filters</button></div>}
          {hasMore && tutors.length > 0 && !error && <div className="browse-load-more"><button className="browse-button browse-button--secondary" disabled={loading} onClick={() => { if (!loading) searchTutors(false); }}><ArrowDown size={16} />{loading ? 'Loading…' : 'Load More Tutors'}</button></div>}
        </div>
      </main>
      {showFilters && <dialog ref={filterDialog} className="browse-filter-dialog" aria-labelledby="browse-filter-title" onCancel={() => setShowFilters(false)} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setShowFilters(false); } }}>
        <div className="browse-filter-dialog-header"><h2 id="browse-filter-title">Lesson availability</h2><button className="browse-icon-button" onClick={() => setShowFilters(false)} aria-label="Close filters" title="Close filters"><X size={20} /></button></div>
        <label htmlFor="browse-date">Lesson day</label><select id="browse-date" value={selectedDate} onChange={e => setSelectedDate(e.currentTarget.value)}>{dates.map(date => <option key={date.value} value={date.value}>{date.label}, {date.day}</option>)}</select>
        <label>Lesson time (JST)</label>{timeControls(' in filters')}
        <div className="browse-filter-dialog-footer"><button className="browse-reset" onClick={clearFilters}><RotateCcw size={14} />Reset</button><button className="browse-button" onClick={() => setShowFilters(false)}>View Tutors <ArrowRight size={16} /></button></div>
      </dialog>}
    </div>
    {selectedTutor && <BookingModal isOpen onClose={() => setSelectedTutor(null)} tutorId={selectedTutor.userId} tutorName={selectedTutor.displayName || `${selectedTutor.firstName} ${selectedTutor.lastName}`} tutorAvatar={selectedTutor.profilePicture} hourlyRate={selectedTutor.hourlyRate} filterDate={selectedDate} />}
  </>;
};
