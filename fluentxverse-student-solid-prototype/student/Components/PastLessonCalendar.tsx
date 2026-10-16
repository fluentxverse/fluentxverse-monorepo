import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock, UserRound } from "lucide-solid";
import { calendarMonthDays, groupCalendarLessons, isCalendarMonth, shiftCalendarMonth } from '../utils/pastLessonCalendar';
import './PastLessonCalendar.css';
interface CalendarLesson {
    id: string;
    tutorName: string;
    date: Date;
    dateStr: string;
    timeDisplay: string;
    duration: number;
    attendanceStudent?: string;
}
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const dateFromKey = (key: string) => new Date(`${key}T00:00:00Z`);
const localDayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
export default function PastLessonCalendar(_props0: {
    lessons: CalendarLesson[];
    renderActions: (bookingId: string) => JSX.Element;
}) {
    const todayParts = localDayFormat.formatToParts(new Date());
    const today = ['year', 'month', 'day'].map(type => todayParts.find(part => part.type === type)!.value).join('-');
    const params = new URLSearchParams(window.location.search);
    const grouped = createMemo(() => groupCalendarLessons(_props0["lessons"]));
    const latestDay = createMemo(() => [...grouped().keys()].sort().at(-1) || today);
    const initialMonth = params.get('month');
    const [month, setMonth] = createSignal(isCalendarMonth(initialMonth) ? initialMonth : latestDay().slice(0, 7));
    const [selectedDay, setSelectedDay] = createSignal(params.get('day') || latestDay());
    const agenda = { current: null } as {
        current: HTMLDivElement | null;
    };
    const monthDays = createMemo(() => calendarMonthDays(month()));
    const lessonDays = createMemo(() => [...grouped().keys()].filter(key => key.startsWith(`${month()}-`)).sort());
    const activeDay = createMemo(() => lessonDays().includes(selectedDay()) ? selectedDay() : lessonDays().at(-1));
    const dayLessons = createMemo(() => activeDay() ? grouped().get(activeDay())! : []);
    const lessonCount = createMemo(() => lessonDays().reduce((total, key) => total + grouped().get(key)!.length, 0));
    const monthName = createMemo(() => monthFormat.format(dateFromKey(`${month()}-01`)));
    createEffect(on(() => [month(), activeDay()], () => {
        const _cleanup1 = untrack(() => {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', 'past');
            url.searchParams.set('month', month());
            if (activeDay())
                url.searchParams.set('day', activeDay());
            else
                url.searchParams.delete('day');
            window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    const selectDay = (key: string) => {
        setSelectedDay(key);
        requestAnimationFrame(() => {
            agenda.current?.focus({ preventScroll: true });
            if (window.matchMedia('(max-width: 1100px)').matches)
                agenda.current?.scrollIntoView({ block: 'start' });
        });
    };
    const singleLessonClick = (key: string) => {
        const url = new URL(window.location.href);
        url.searchParams.set('day', key);
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    };
    return <div class="past-calendar-layout">
    <section class="past-calendar" aria-label="Past lessons calendar">
      <header class="past-calendar-toolbar">
        <div><h2>{monthName()}</h2><p>{lessonCount()} lesson{lessonCount() !== 1 ? 's' : ''}</p></div>
        <div class="past-calendar-controls">
          <input type="month" aria-label="Calendar month" value={month()} onInput={event => { if (isCalendarMonth(event.currentTarget.value))
        setMonth(event.currentTarget.value); }}/>
          <button type="button" aria-label="Previous month" title="Previous month" onClick={() => setMonth(value => shiftCalendarMonth(value, -1))}><ChevronLeft size={18}/></button>
          <button type="button" aria-label="Next month" title="Next month" onClick={() => setMonth(value => shiftCalendarMonth(value, 1))}><ChevronRight size={18}/></button>
          <button type="button" aria-label="Current month" title="Current month" onClick={() => setMonth(today.slice(0, 7))}><CalendarDays size={18}/></button>
        </div>
      </header>
      <div class="past-calendar-weekdays" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span>{day}</span>)}</div>
      <div class="past-calendar-grid">
        {monthDays().map(day => {
            const items = day.inMonth ? grouped().get(day.key) || [] : [];
            const label = `${dayFormat.format(dateFromKey(day.key))}: ${items.length} lesson${items.length !== 1 ? 's' : ''}`;
            const classes = `past-calendar-day${!day.inMonth ? ' outside' : ''}${items.length ? ' has-lessons' : ''}${day.key === activeDay() ? ' selected' : ''}${day.key === today ? ' today' : ''}`;
            const content = <><span class="past-calendar-day-number">{day.day}</span>{items.length > 0 && <span class="past-calendar-day-count"><span class="past-calendar-count-dot"/>{items.length}<span class="past-calendar-count-label"> lesson{items.length !== 1 ? 's' : ''}</span></span>}{items.length === 1 && <span class="past-calendar-day-time">{items[0]!.timeDisplay}</span>}</>;
            return items.length === 1 ? <a href={`/lesson/${encodeURIComponent(items[0]!.id)}`} class={classes} aria-label={label} aria-current={day.key === today ? 'date' : undefined} onClick={() => singleLessonClick(day.key)}>{content}</a>
                : <button type="button" class={classes} aria-label={label} disabled={!items.length} aria-pressed={items.length ? day.key === activeDay() : undefined} aria-current={day.key === today ? 'date' : undefined} aria-controls="past-calendar-agenda" onClick={() => selectDay(day.key)}>{content}</button>;
        })}
      </div>
      {!lessonCount() && <p class="past-calendar-empty" role="status">No past lessons in {monthName()}.</p>}
    </section>
    <div id="past-calendar-agenda" class="past-calendar-agenda" ref={_element => agenda.current = _element} tabIndex={-1} aria-label="Lessons on selected day">
      <header><h2><Clock size={17}/>Lessons on this day</h2>{activeDay() && <select aria-label="Lesson day" value={activeDay()} onChange={event => setSelectedDay(event.currentTarget.value)}>{lessonDays().map(key => <option value={key}>{shortDayFormat.format(dateFromKey(key))} - {grouped().get(key)!.length} lesson{grouped().get(key)!.length !== 1 ? 's' : ''}</option>)}</select>}</header>
      {activeDay() ? <div class="past-calendar-day-lessons">{dayLessons().map(lesson => <article class="past-calendar-lesson">
        <div class="past-calendar-lesson-time"><Clock size={15}/><strong>{lesson.timeDisplay} JST</strong><span>{lesson.duration} min</span></div>
        <p class="past-calendar-tutor"><UserRound size={16}/>{lesson.tutorName}</p>
        <p class={`past-calendar-attendance ${lesson.attendanceStudent === 'absent' ? 'absent' : 'present'}`}>{lesson.attendanceStudent === 'absent' ? 'Absent' : 'Present'}</p>
        <a class="past-calendar-open-lesson" href={`/lesson/${encodeURIComponent(lesson.id)}`}>View lesson<ArrowRight size={16}/></a>
        <div class="past-calendar-lesson-actions">{_props0["renderActions"](lesson.id)}</div>
      </article>)}</div> : <p class="past-calendar-empty">No lesson records for this month.</p>}
    </div>
  </div>;
}
