import { batch, onMount, createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { TICKETING_VISIBLE } from '../config/launch';
import { cssStyle, Fragment } from "../utils/cssStyle";
import { Search, X, CalendarDays, SlidersHorizontal, ArrowRight, ArrowDown, RotateCcw, Star, ShieldCheck, MapPin, Languages, Video, Plus } from "lucide-solid";
import { tutorApi } from '../api/tutor.api';
import type { Tutor } from '../types/tutor.types';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { BookingModal } from '../Components/Booking/BookingModal';
import ProfileAvatar from '../Components/Common/ProfileAvatar';
import { useAuthContext } from '../context/AuthContext';
import LoadingSpinner from '../Components/LoadingSpinner';
import { API_BASE_URL } from '../config/api';
import { BROWSE_START_TIMES, BROWSE_END_TIMES, bookableBrowseStarts, browseOperationalDate, browseTimeLabel as timeLabel, defaultBrowseTimeRange, normalizeBrowseTimeRange, type BrowseTimeRange } from '../utils/browseTimeFilter';
import './BrowseTutorsPage.css';
function TutorCard(_props0: {
    tutor: Tutor;
    onBook: (tutor: Tutor) => void;
}) {
    const name = createMemo(() => _props0["tutor"].displayName || `${_props0["tutor"].firstName} ${_props0["tutor"].lastName}`);
    const profileUrl = createMemo(() => `/tutor/${encodeURIComponent(_props0["tutor"].userId)}`);
    const initials = createMemo(() => `${_props0["tutor"].firstName?.[0] || ''}${_props0["tutor"].lastName?.[0] || ''}`.toUpperCase());
    const proofLabels = { local_proof_generated: 'ZK Proof Ready', submitted: 'zkVerify Pending', verified: 'ZK Verified' };
    const proofLabel = createMemo(() => _props0["tutor"].zkCertificationStatus && proofLabels[_props0["tutor"].zkCertificationStatus as keyof typeof proofLabels]);
    return (<article class="browse-tutor-card">
      <div class="browse-tutor-profile">
        <a href={profileUrl()} aria-label={`View ${name()}'s profile`} class="browse-tutor-avatar-link">
          <ProfileAvatar src={_props0["tutor"].profilePicture} alt={name()} className="browse-tutor-avatar" fallbackClassName="browse-tutor-avatar--fallback" fallback={initials()}/>
        </a>
        <div class="browse-tutor-info">
          {_props0["tutor"].isAvailable && <span class="browse-available"><span />Open slots</span>}
          <h2><a href={profileUrl()}>{name()}</a></h2>
          <div class="browse-tutor-rating">
            {_props0["tutor"].rating && (_props0["tutor"].totalReviews || 0) > 0 ? <><Star size={15} fill="currentColor"/><strong>{_props0["tutor"].rating.toFixed(1)}</strong><span>({_props0["tutor"].totalReviews} {_props0["tutor"].totalReviews === 1 ? 'review' : 'reviews'})</span></> : <span>No reviews yet</span>}
          </div>
        </div>
      </div>
      {(_props0["tutor"].isVerified || proofLabel()) && <div class="browse-tutor-credentials">
        {_props0["tutor"].isVerified && <span><ShieldCheck size={14}/>Verified</span>}
        {proofLabel() && (_props0["tutor"].zkCredentialCommitment ? <a href={`${API_BASE_URL}/proof/tutor-certification/public/${encodeURIComponent(_props0["tutor"].zkCredentialCommitment)}`} target="_blank" rel="noreferrer"><ShieldCheck size={14}/>{proofLabel()}</a> : <span><ShieldCheck size={14}/>{proofLabel()}</span>)}
      </div>}
      {_props0["tutor"].bio && <p class="browse-tutor-bio">{_props0["tutor"].bio}</p>}
      <div class="browse-tutor-details">
        {_props0["tutor"].languages?.length ? <span><Languages size={15}/>{_props0["tutor"].languages.slice(0, 3).join(', ')}</span> : null}
        {_props0["tutor"].country && <span><MapPin size={15}/>{_props0["tutor"].country}</span>}
        {typeof _props0["tutor"].totalSessions === 'number' && <span><Video size={15}/>{_props0["tutor"].totalSessions} lessons</span>}
      </div>
      {_props0["tutor"].specializations?.length ? <div class="browse-tutor-tags">{_props0["tutor"].specializations.slice(0, 3).map(spec => <span>{spec}</span>)}</div> : null}
      <div class="browse-tutor-actions">
        <a href={profileUrl()} class="browse-button browse-button--secondary">View Profile</a>
        <button class="browse-button" onClick={() => _props0["onBook"](_props0["tutor"])} aria-label={`Show schedule for ${name()}`}><CalendarDays size={16}/>Show Schedule</button>
      </div>
    </article>);
}
export const BrowseTutorsPage = () => {
    const _state1 = useAuthContext();
    const [tutors, setTutors] = createSignal<Tutor[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);
    const [total, setTotal] = createSignal(0);
    const [hasMore, setHasMore] = createSignal(false);
    const [page, setPage] = createSignal(1);
    const pageRef = { current: page() } as {
        current: any;
    };
    createEffect(() => pageRef.current = page());
    const requestId = { current: 0 } as {
        current: any;
    };
    const [draftQuery, setDraftQuery] = createSignal('');
    const [query, setQuery] = createSignal('');
    const initialNow = Date.now();
    const initialRange = defaultBrowseTimeRange(initialNow);
    const [now, setNow] = createSignal(initialNow);
    const [selectedDate, setSelectedDate] = createSignal(initialRange.date);
    const [startTime, setStartTime] = createSignal(initialRange.startTime);
    const [endTime, setEndTime] = createSignal(initialRange.endTime);
    const [showFilters, setShowFilters] = createSignal(false);
    const filterDialog = { current: null } as {
        current: HTMLDialogElement | null;
    };
    const filterButton = { current: null } as {
        current: HTMLButtonElement | null;
    };
    const [selectedTutor, setSelectedTutor] = createSignal<Tutor | null>(null);
    const [balance, setBalance] = createSignal<{
        basic: number;
        premium: number;
        trial: number;
    } | null>(null);
    const today = createMemo(() => browseOperationalDate(now()));
    const firstToday = createMemo(() => bookableBrowseStarts(today(), now())[0]);
    const defaults = createMemo(on(() => [today(), firstToday()], () => defaultBrowseTimeRange(untrack(now))));
    const startOptions = createMemo(() => selectedDate() > today() ? BROWSE_START_TIMES
        : selectedDate() === today() && firstToday() ? BROWSE_START_TIMES.filter(time => time >= firstToday()) : []);
    const endOptions = createMemo(() => BROWSE_END_TIMES.filter(time => time > startTime()));
    const applyRange = (range: BrowseTimeRange) => batch(() => {
        setSelectedDate(range.date);
        setStartTime(range.startTime);
        setEndTime(range.endTime);
    });
    const selectDate = (date: string) => {
        const current = Date.now();
        batch(() => {
            setNow(current);
            applyRange(normalizeBrowseTimeRange({ date, startTime: startTime(), endTime: endTime() }, current));
        });
    };
    const selectStart = (time: string) => applyRange(normalizeBrowseTimeRange({ date: selectedDate(), startTime: time, endTime: endTime() }, Date.now()));
    onMount(() => {
        const refresh = () => { if (!document.hidden) setNow(Date.now()); };
        const timer = window.setInterval(refresh, 1000);
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        onCleanup(() => {
            window.clearInterval(timer);
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        });
    });
    createEffect(on(() => [today(), firstToday()], () => {
        applyRange(normalizeBrowseTimeRange({ date: selectedDate(), startTime: startTime(), endTime: endTime() }, untrack(now)));
    }));
    const dates = createMemo(() => Array.from({ length: 7 }, (_, index) => {
        const date = new Date(`${today()}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + index);
        return { value: date.toISOString().slice(0, 10), label: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date), day: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date) };
    }));
    const filtered = createMemo(() => !!query() || selectedDate() !== defaults().date || startTime() !== defaults().startTime || endTime() !== defaults().endTime);
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            document.title = 'Browse Tutors | FluentXVerse';
            return () => { requestId.current++; };
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    createEffect(on(() => [_state1.isAuthenticated, _state1.user?.walletAddress], () => {
        const _cleanup3 = untrack(() => {
            let cancelled = false;
            setBalance(null);
            if (TICKETING_VISIBLE && _state1.isAuthenticated && _state1.user?.walletAddress) {
                fetch(`${API_BASE_URL}/tickets/balance/${encodeURIComponent(_state1.user.walletAddress)}`)
                    .then(response => response.ok ? response.json() : Promise.reject())
                    .then(result => { if (!cancelled && result.success)
                    setBalance(result.data); })
                    .catch(() => { });
            }
            return () => { cancelled = true; };
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    createEffect(on(() => [showFilters()], () => {
        const _cleanup4 = untrack(() => {
            if (!showFilters() || !filterDialog.current)
                return;
            const dialog = filterDialog.current;
            const overflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            dialog.showModal();
            return () => { dialog.close(); document.body.style.overflow = overflow; filterButton.current?.focus(); };
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    const searchTutors = createMemo(on(() => [query(), selectedDate(), startTime(), endTime()], () => async (reset = true) => {
        const id = ++requestId.current;
        const nextPage = reset ? 1 : pageRef.current + 1;
        setLoading(true);
        setError(null);
        if (reset)
            setTutors([]);
        try {
            const result = await tutorApi.searchTutors({ get query() {
                    return query() || undefined;
                }, get dateFilter() {
                    return selectedDate();
                }, get startTime() {
                    return startTime();
                }, get endTime() {
                    return endTime();
                }, page: nextPage, limit: 12 });
            if (id !== requestId.current)
                return;
            setTutors(previous => reset ? result.tutors : [...previous, ...result.tutors.filter(tutor => !previous.some(existing => existing.userId === tutor.userId))]);
            setPage(nextPage);
            setTotal(result.total);
            setHasMore(result.hasMore);
        }
        catch {
            if (id === requestId.current)
                setError('Tutors could not be loaded. Please try again.');
        }
        finally {
            if (id === requestId.current)
                setLoading(false);
        }
    }));
    createEffect(on(() => [searchTutors()], () => {
        const _cleanup5 = untrack(() => { searchTutors()(); });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    const clearFilters = () => {
        const current = Date.now(), range = defaultBrowseTimeRange(current);
        const unchanged = !query() && selectedDate() === range.date && startTime() === range.startTime && endTime() === range.endTime;
        batch(() => {
            setNow(current);
            setDraftQuery('');
            setQuery('');
            applyRange(range);
        });
        if (unchanged) searchTutors()();
    };
    const timeControls = (suffix: string) => <div class="browse-time-controls">
    <span class="browse-time-label">JST</span>
    <select aria-label={`Start time${suffix}`} value={startTime()} onChange={e => selectStart(e.currentTarget.value)}>
      {startOptions().map(time => <option value={time}>{timeLabel(time)}</option>)}
    </select>
    <span aria-hidden="true">–</span>
    <select aria-label={`End time${suffix}`} value={endTime()} onChange={e => setEndTime(e.currentTarget.value)}>
      {endOptions().map(time => <option value={time}>{timeLabel(time)}</option>)}
    </select>
  </div>;
    return createMemo(() => {
        if (_state1.initialLoading)
            return <div class="browse-auth-check"><LoadingSpinner /></div>;
        return <>
    {_state1.isAuthenticated && <SideBar />}
    <div class={`browse-page ${_state1.isAuthenticated ? 'browse-page--with-sidebar' : 'browse-page--public'}`}>
      <Header />
      <main class="browse-main">
        <div class="browse-container">
          <div class="browse-page-heading">
            <img src="/assets/img/browse/community-v1.webp" width={64} height={64} alt="" aria-hidden="true"/>
            <div><h1>Browse Tutors</h1><p>English lessons, on your schedule.</p></div>
            {TICKETING_VISIBLE && _state1.isAuthenticated && <a href="/tickets" class="browse-ticket-link"><Plus size={16}/>Get Tickets</a>}
          </div>
          {TICKETING_VISIBLE && _state1.isAuthenticated && <section class="browse-ticket-summary" aria-label="Your tickets">
            {balance() ? (['trial', 'basic', 'premium'] as const).filter(tier => tier !== 'trial' || balance().trial > 0).map(tier => <span><img src={tier === 'trial' ? '/assets/img/icons/trial_ticket.webp' : `/assets/img/home-icons/${tier}-ticket-v2.png`} width={48} height={30} alt=""/><strong>{balance()[tier]}</strong>{tier[0].toUpperCase() + tier.slice(1)} tickets</span>) : <a href="/tickets">View ticket balance <ArrowRight size={14}/></a>}
          </section>}
          <div class="browse-search-toolbar">
            <form class="browse-search" role="search" onSubmit={e => { e.preventDefault(); const next = draftQuery().trim(); if (next === query())
            searchTutors()();
        else
            setQuery(next); }}>
              <Search size={18} aria-hidden="true"/>
              <input aria-label="Search tutors by name" placeholder="Search tutor name" value={draftQuery()} onInput={e => setDraftQuery(e.currentTarget.value)}/>
              {draftQuery() && <button type="button" class="browse-icon-button" aria-label="Clear search" title="Clear search" onClick={() => { setDraftQuery(''); setQuery(''); }}><X size={16}/></button>}
              <button class="browse-button" type="submit">Search</button>
            </form>
            <div class="browse-toolbar-time">{timeControls('')}</div>
            <button ref={_element => filterButton.current = _element} class="browse-button browse-button--secondary browse-filter-button" onClick={() => setShowFilters(true)} aria-haspopup="dialog"><SlidersHorizontal size={17}/>Filters</button>
          </div>
          <div class="browse-day-strip" aria-label="Availability day">
            {dates().map(date => <button aria-pressed={selectedDate() === date.value} disabled={date.value === today() && !firstToday()} onClick={() => selectDate(date.value)}><strong>{date.label}</strong><span>{date.day}</span></button>)}
          </div>
          <div class="browse-results-header">
            <p role="status">{loading() ? 'Finding tutors…' : `${tutors().length} of ${total()} ${total() === 1 ? 'tutor' : 'tutors'}`}</p>
            {filtered() && <button class="browse-reset" onClick={clearFilters}><RotateCcw size={14}/>Reset filters</button>}
          </div>
          {error() && <div class="browse-error" role="alert"><p>{error()}</p><button class="browse-button browse-button--secondary" onClick={() => searchTutors()(tutors().length === 0)}><RotateCcw size={15}/>Try Again</button></div>}
          <div class="browse-grid" aria-busy={loading()}>
            {loading() && tutors().length === 0 ? Array.from({ length: 6 }, (_, index) => <div class="browse-tutor-skeleton" aria-hidden="true"><span /><div /><div /></div>) : tutors().map(tutor => <TutorCard tutor={tutor} onBook={setSelectedTutor}/>)}
          </div>
          {!loading() && !error() && tutors().length === 0 && <div class="browse-empty"><Search size={32}/><h2>No matching tutors</h2><p>There are no open lessons for this search.</p><button class="browse-button browse-button--secondary" onClick={clearFilters}><RotateCcw size={16}/>Reset filters</button></div>}
          {hasMore() && tutors().length > 0 && !error() && <div class="browse-load-more"><button class="browse-button browse-button--secondary" disabled={loading()} onClick={() => { if (!loading())
            searchTutors()(false); }}><ArrowDown size={16}/>{loading() ? 'Loading…' : 'Load More Tutors'}</button></div>}
        </div>
      </main>
      {showFilters() && <dialog ref={_element => filterDialog.current = _element} class="browse-filter-dialog" aria-labelledby="browse-filter-title" onCancel={() => setShowFilters(false)} onClick={e => { if (e.target === e.currentTarget) {
                const r = e.currentTarget.getBoundingClientRect();
                if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
                    setShowFilters(false);
            } }}>
        <div class="browse-filter-dialog-header"><h2 id="browse-filter-title">Lesson availability</h2><button class="browse-icon-button" onClick={() => setShowFilters(false)} aria-label="Close filters" title="Close filters"><X size={20}/></button></div>
        <label for="browse-date">Lesson day</label><select id="browse-date" value={selectedDate()} onChange={e => selectDate(e.currentTarget.value)}>{dates().map(date => <option value={date.value} disabled={date.value === today() && !firstToday()}>{date.label}, {date.day}</option>)}</select>
        <label>Lesson time (JST)</label>{timeControls(' in filters')}
        <div class="browse-filter-dialog-footer"><button class="browse-reset" onClick={clearFilters}><RotateCcw size={14}/>Reset</button><button class="browse-button" onClick={() => setShowFilters(false)}>View Tutors <ArrowRight size={16}/></button></div>
      </dialog>}
    </div>
    {selectedTutor() && <BookingModal isOpen onClose={() => setSelectedTutor(null)} tutorId={selectedTutor().userId} tutorName={selectedTutor().displayName || `${selectedTutor().firstName} ${selectedTutor().lastName}`} tutorAvatar={selectedTutor().profilePicture} hourlyRate={selectedTutor().hourlyRate} filterDate={selectedDate()}/>}
  </>;
    }) as unknown as JSX.Element;
};
