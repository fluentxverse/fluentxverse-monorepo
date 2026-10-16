import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import TutorArt from "../Components/Common/TutorArt";
import { getTutorPerformance, currentPhtMonth, type MetricsPeriod, type MetricOutcome, type TutorPerformance, } from "../api/performance.api";
import SideBar from "../Components/IndexOne/SideBar";
import DashboardHeader from "../Components/Dashboard/DashboardHeader";
import "./PerformanceMetricsPage.css";
import LessonIssuesView from '../Components/Performance/LessonIssuesView';
import type { IssueDirection, IssueFilter } from '../api/lessonIssues.api';
import { useLocation } from '../routing';
type Tab = "lessons" | "rating" | "reliability" | "issues" | "formula";
const tabs: {
    id: Tab;
    label: string;
    icon: string;
}[] = [
    { id: "lessons", label: "Lessons", icon: "book-alt" },
    {
        id: "reliability",
        label: "Attendance & reliability",
        icon: "shield-check"
    },
    { id: "issues", label: "Lesson issues", icon: "comment" },
    { id: "rating", label: "Rating", icon: "star" },
    { id: "formula", label: "Calculations", icon: "calculator" },
];
const outcomes: {
    id: MetricOutcome;
    label: string;
    tone: string;
}[] = [
    { id: "attended", label: "Attended", tone: "green" },
    { id: "tutor_absent", label: "Tutor absent", tone: "red" },
    { id: "student_absent", label: "Student absent", tone: "amber" },
    { id: "awaiting_verification", label: "Pending verification", tone: "gray" },
    { id: "upcoming", label: "Upcoming", tone: "blue" },
    { id: "ongoing", label: "In session", tone: "blue" },
    { id: "cancelled", label: "Cancelled", tone: "gray" },
    { id: "unclassified", label: "Missing schedule data", tone: "gray" },
];
const noteLabels: Record<string, string> = {
    submitted: "Submitted",
    changes_pending: "Updates pending",
    draft: "Not submitted",
    not_required: "Not required",
    not_due: "Not due"
};
const percent = (value: number | null) => value === null ? "No data" : `${value}%`;
const time = (date: string | null) => date && Number.isFinite(Date.parse(date))
    ? new Date(date).toLocaleString("en-US", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    })
    : "Not recorded";
const initialTab = (hash = window.location.hash): Tab => tabs.some((t) => t.id === hash.slice(1))
    ? (hash.slice(1) as Tab)
    : "lessons";
export const PerformanceMetricsPage = () => {
    const location = useLocation();
    const [tab, setTab] = createSignal<Tab>(initialTab(location.hash));
    const [period, setPeriod] = createSignal<MetricsPeriod>((() => {
        const value = new URLSearchParams(location.search).get("period");
        return value === "all" || value === "30days" ? value : "month";
    })());
    const [month, setMonth] = createSignal(currentPhtMonth());
    const [page, setPage] = createSignal(1);
    const [issueDirection, setIssueDirection] = createSignal<IssueDirection>('sent');
    const [issueStatus, setIssueStatus] = createSignal<IssueFilter>('all');
    const [data, setData] = createSignal<TutorPerformance | null>(null);
    const [error, setError] = createSignal("");
    const [loading, setLoading] = createSignal(true);
    const [revision, setRevision] = createSignal(0);
    createEffect(on(() => location.hash, hash => setTab(initialTab(hash))));
    createEffect(on(() => [], () => {
        const _cleanup3 = untrack(() => {
            document.title = "Performance Metrics | FluentXVerse";
            const focus = () => {
                if (!document.hidden)
                    setRevision((n) => n + 1);
            };
            const hash = () => setTab(initialTab());
            const timer = window.setInterval(focus, 60000);
            window.addEventListener("focus", focus);
            window.addEventListener("hashchange", hash);
            return () => {
                clearInterval(timer);
                window.removeEventListener("focus", focus);
                window.removeEventListener("hashchange", hash);
            };
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    createEffect(on(() => [period(), month(), page(), revision()], () => {
        const _cleanup4 = untrack(() => {
            const controller = new AbortController();
            setLoading(true);
            setError("");
            getTutorPerformance(period(), month(), page(), controller.signal)
                .then((value) => {
                if (!controller.signal.aborted)
                    setData(value);
            })
                .catch((err) => {
                if (!controller.signal.aborted) {
                    setData(null);
                    setError(err.response?.data?.error ||
                        err.message ||
                        "Could not load performance metrics");
                }
            })
                .finally(() => {
                if (!controller.signal.aborted)
                    setLoading(false);
            });
            return () => controller.abort();
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    const selectTab = (value: Tab) => {
        setTab(value);
        location.route(`${location.path}${location.search}#${value}`, true);
    };
    const ready = createMemo(() => data() &&
        data().period.period === period() &&
        (period() !== "month" || data().period.month === month()) &&
        data().page === page()
        ? data() : null);
    return (<>
			<SideBar />
			<div class="main-content">
				<DashboardHeader />
				<main class="performance-metrics-page">
					<header class="metrics-header">
						<div>
							<a href="/profile" class="metrics-back">
								<TutorIcon name="fi fi-sr-arrow-left" aria-hidden="true"/>
								Profile
							</a>
							<h1>
								<TutorArt name="growth" size={32}/>
								Performance Metrics
							</h1>
						</div>
						<div class="metrics-controls">
							<label>
								Period
								<select aria-label="Metrics period" value={period()} onChange={(e) => {
            setPeriod(e.currentTarget.value as MetricsPeriod);
            setPage(1);
        }}>
									<option value="month">Month</option>
									<option value="30days">Last 30 days</option>
									<option value="all">All time</option>
								</select>
							</label>
							{period() === "month" && (<label>
									Month
									<input aria-label="Metrics month" type="month" min="2000-01" max={currentPhtMonth()} value={month()} onInput={(e) => {
                if (e.currentTarget.value) {
                    setMonth(e.currentTarget.value);
                    setPage(1);
                }
            }}/>
								</label>)}
							<button type="button" class="metrics-icon-button" title="Refresh metrics" aria-label="Refresh metrics" disabled={loading()} onClick={() => setRevision((n) => n + 1)}>
								<TutorIcon name="fi fi-sr-refresh" aria-hidden="true"/>
							</button>
						</div>
					</header>
					<div class="metrics-meta">
						<span>Philippine Time (PHT)</span>
						<span>
							{loading() ? "Updating..."
            : ready() ? `Updated ${time(ready().generatedAt)}`
                : "Not available"}
						</span>
					</div>
					{error() && (<div class="metrics-error" role="alert">
							{error()}
							<button type="button" onClick={() => setRevision((n) => n + 1)}>
								Retry
							</button>
						</div>)}
					{!ready() && loading() && (<div class="metrics-loading" role="status">
							Loading metrics...
						</div>)}
					{ready() && (<>
							<section class="metrics-overview" aria-label="Performance summary">
								<div class="metrics-overview-card metrics-scheduling-card">
									<h2><TutorArt name="schedule" size={32}/>Scheduling</h2>
									<div class="metrics-kpis">
										<Metric label="Bookable slots" value={ready().slots?.bookable ?? '--'} icon="calendar"/>
										<Metric label="Booked slots" value={ready().slots?.booked ?? '--'} icon="book-alt" tone="green"/>
									</div>
								</div>
								<div class="metrics-overview-card">
								<h2><TutorArt name="training" size={32}/>Teaching</h2>
								<div class="metrics-kpis">
								<Metric label="Attended lessons" value={ready().lessons.attended} icon="check" tone="green"/>
								<Metric label="Teaching hours" value={ready().lessons.teachingHours} icon="clock"/>
								</div></div>
								<div class="metrics-overview-card">
								<h2><TutorArt name="community" size={32}/>Attendance & notes</h2>
								<div class="metrics-kpis metrics-quality-stats">
								<Metric label="Tutor attendance" value={percent(ready().attendance.rate)} icon="calendar" tone="teal"/>
								<Metric label="Reliability" value={percent(ready().reliability.score)} icon="shield-check" tone="amber"/>
								<Metric label="Cancellation/absence ratio" value={percent(ready().cancellation?.rate ?? null)} icon="calendar" tone="red"/>
								<Metric label="Notes overdue" value={ready().notes.overdue} icon="document" tone={ready().notes.overdue ? "red" : "gray"}/>
								</div></div>
							</section>
							<nav class="metrics-tabs" aria-label="Performance views">
								{tabs.map((item) => (<button type="button" aria-current={tab() === item.id ? "page" : undefined} class={tab() === item.id ? "active" : ""} onClick={() => selectTab(item.id)}>
										<TutorIcon name={`fi fi-sr-${item.icon}`} aria-hidden="true"/>
										{item.label}
									</button>))}
							</nav>
							{tab() === "issues" && <LessonIssuesView period={period()} month={month()} revision={revision()}
              direction={issueDirection()} status={issueStatus()} onDirection={setIssueDirection} onStatus={setIssueStatus}/>}
							{tab() === "lessons" && (<>
									<section class="metrics-section">
										<h2>Lesson outcomes</h2>
										<div class="metrics-outcomes">
											{outcomes
                    .filter((o) => o.id !== "unclassified" ||
                    ready().lessons.unclassified)
                    .map((o) => (<div>
														<span class={`metrics-dot ${o.tone}`}/>
														<span>{o.label}</span>
														<strong>{ready().lessons[o.id]}</strong>
													</div>))}
										</div>
									</section>
									<section class="metrics-section">
										<div class="metrics-section-heading">
											<h2>
												{period() === "all"
                    ? "Last 12 months"
                    : "Daily lesson activity"}
											</h2>
											<div class="metrics-legend">
												<span>
													<TutorIcon name="metrics-dot green"/>
													Attended
												</span>
												<span>
													<TutorIcon name="metrics-dot red"/>
													Tutor absent
												</span>
												<span>
													<TutorIcon name="metrics-dot amber"/>
													Student absent
												</span>
												<span>
													<TutorIcon name="metrics-dot gray"/>
													Unverified
												</span>
											</div>
										</div>
										<ActivityChart data={ready()}/>
									</section>
									<section class="metrics-section">
										<h2>Lesson notes</h2>
										<div class="metrics-inline-stats">
											<Count label="Submitted" value={ready().notes.submitted}/>
											<Count label="Updates pending" value={ready().notes.pendingUpdates}/>
											<Count label="Not submitted" value={ready().notes.drafts}/>
											<Count label="Overdue" value={ready().notes.overdue} tone="red"/>
											<Count label="Not required" value={ready().notes.notRequired}/>
											<Count label="Submission rate" value={percent(ready().notes.submissionRate)}/>
										</div>
									</section>
									<section class="metrics-section">
										<div class="metrics-section-heading">
											<h2>Booked lessons</h2>
											<span>{ready().lessons.total} total</span>
										</div>
										{!ready().recentLessons.length ? (<p class="metrics-empty">
												No booked lessons in this period.
											</p>) : (<div class="metrics-table-scroll">
												<table class="metrics-table">
													<thead>
														<tr>
															<th>Date & time (PHT)</th>
															<th>Student</th>
															<th>Duration</th>
															<th>Outcome</th>
															<th>Notes</th>
															<th>
																<span class="metrics-sr-only">Lesson</span>
															</th>
														</tr>
													</thead>
													<tbody>
														{ready().recentLessons.map((lesson) => {
                        const outcome = outcomes.find((o) => o.id === lesson.outcome)!;
                        return (<tr>
																	<td>{time(lesson.startsAt)}</td>
																	<td>{lesson.studentName}</td>
																	<td>{lesson.durationMinutes} min</td>
																	<td>
																		<span class={`metrics-status ${outcome.tone}`}>
																			{outcome.label}
																		</span>
																	</td>
																	<td>
																		{noteLabels[lesson.notesStatus] ||
                                lesson.notesStatus}
																	</td>
																	<td>
																		<a href={`/lesson/${encodeURIComponent(lesson.bookingId)}`} class="metrics-icon-button" title="Open lesson" aria-label={`Open lesson with ${lesson.studentName}`}>
																			<TutorIcon name="fi fi-sr-arrow-right" aria-hidden="true"/>
																		</a>
																	</td>
																</tr>);
                    })}
													</tbody>
												</table>
											</div>)}
										{ready().totalPages > 1 && (<div class="metrics-pagination">
												<span>
													Page {ready().page} of {ready().totalPages}
												</span>
												<button type="button" class="metrics-icon-button" aria-label="Previous page" title="Previous page" disabled={page() <= 1 || loading()} onClick={() => setPage((n) => n - 1)}>
													<TutorIcon name="fi fi-sr-angle-left" aria-hidden="true"/>
												</button>
												<button type="button" class="metrics-icon-button" aria-label="Next page" title="Next page" disabled={page() >= ready().totalPages || loading()} onClick={() => setPage((n) => n + 1)}>
													<TutorIcon name="fi fi-sr-angle-right" aria-hidden="true"/>
												</button>
											</div>)}
									</section>
								</>)}
							{tab() === "reliability" && (<>
									<section class="metrics-section">
										<h2>Tutor attendance</h2>
										<div class="metrics-inline-stats">
											<Count label="Present" value={ready().attendance.present} tone="green"/>
											<Count label="Absent" value={ready().attendance.absent} tone="red"/>
											<Count label="Unverified" value={ready().attendance.unverified}/>
											<Count label="Verified attendance rate" value={percent(ready().attendance.rate)}/>
										</div>
									</section>
									<section class="metrics-section">
										<h2>Cancellation/absence ratio</h2>
										<div class="metrics-inline-stats">
											<Count label="Affected slots" value={ready().cancellation?.affectedSlots ?? '--'} tone="red"/>
											<Count label="Ended published slots" value={ready().cancellation?.eligibleSlots ?? '--'}/>
											<Count label="Ratio (lower is better)" value={percent(ready().cancellation?.rate ?? null)}/>
										</div>
									</section>
									<section class="metrics-section">
										<h2>Reliability</h2>
										<div class="metrics-score">
											<strong>{percent(ready().reliability.score)}</strong>
											<progress aria-label="Reliability score" max={100} value={ready().reliability.score || 0}/>
										</div>
										<div class="metrics-inline-stats">
											<Count label="Eligible booked slots" value={ready().reliability.bookedSlots}/>
											<Count label="Eligible unbooked slots" value={ready().reliability.unbookedSlots}/>
											<Count label="Penalty points" value={ready().reliability.penaltyPoints} tone="red"/>
										</div>
										<dl class="metrics-penalty-counts">
											{Object.entries(ready().reliability.weights).map(([code, weight]) => (<div>
														<dt>TA-{code}</dt>
														<dd>
															{ready().reliability.penaltyCounts[code] || 0}{" "}
															incidents <span>&times; {weight} points</span>
														</dd>
													</div>))}
										</dl>
									</section>
									<section class="metrics-section">
										<div class="metrics-section-heading">
											<h2>Recent penalty records</h2>
											<span>{ready().penaltyTotal} records</span>
										</div>
										{!ready().penalties.length ? (<p class="metrics-empty">
												No penalty records in this period.
											</p>) : (<ul class="metrics-incidents">
												{ready().penalties.map((p) => (<li>
														<strong>{p.code}</strong>
														<div>
															<p>{p.reason}</p>
															<small>
																{time(p.startsAt)} PHT
																{p.excludedFromScore
                            ? " · Excluded from score"
                            : ""}
															</small>
														</div>
														<span>{p.points} pts</span>
														{p.bookingId && (<a class="metrics-icon-button" href={`/lesson/${encodeURIComponent(p.bookingId)}`} title="Open lesson" aria-label="Open penalty lesson">
																<TutorIcon name="fi fi-sr-arrow-right" aria-hidden="true"/>
															</a>)}
													</li>))}
											</ul>)}
									</section>
								</>)}
							{tab() === "rating" && (<>
								<section class="metrics-section">
									<h2>
										Student ratings <small>All time</small>
									</h2>
									<div class="metrics-inline-stats">
										<Count label="Average rating" value={ready().rating.average === null
                    ? "No ratings"
                    : `${ready().rating.average.toFixed(1)} / 5`} tone="amber"/>
										<Count label="Recorded reviews" value={ready().rating.totalReviews}/>
									</div>
								</section>
								<section class="metrics-section">
									<h2>Lesson surveys <small>Selected period</small></h2>
									<div class="metrics-inline-stats">
										<Count label="Submitted surveys" value={ready().survey?.total ?? 0}/>
										<Count label="Overall lesson rating" value={ready().survey?.average == null ? 'No ratings' : `${ready().survey.average.toFixed(1)} / 5`} tone="amber"/>
									</div>
									{ready().survey?.total ? <div class="metrics-survey-bars" aria-label="Lesson rating distribution">
										{[...ready().survey.distribution].reverse().map(item => <div class="metrics-survey-row">
											<span>{item.rating} star{item.rating > 1 ? 's' : ''}</span><progress aria-label={`${item.rating}-star ratings`} max={ready().survey.total} value={item.count}/><strong>{item.count}</strong>
										</div>)}
									</div> : <p class="metrics-empty">No lesson surveys submitted in this period.</p>}
								</section>
								{(['positive', 'improvement'] as const).map(group => <section class={`metrics-section metrics-survey-${group}`}>
									<h2>{group === 'positive' ? 'Satisfaction points' : 'Areas for improvement'}</h2>
									{ready().survey?.total ? <>
										<p class="metrics-survey-caption">Share of {ready().survey.total} submitted survey{ready().survey.total === 1 ? '' : 's'} in the selected period</p>
										<div class="metrics-survey-bars">{ready().survey.topics.filter(topic => group === 'improvement' || topic.positiveEnabled).map(topic => <div class="metrics-survey-row">
											<span>{topic.label}</span><progress aria-label={`${topic.label}: ${group === 'positive' ? 'satisfaction' : 'improvement'}`} max={100} value={topic[group === 'positive' ? 'positiveRate' : 'improvementRate'] || 0}/><strong>{percent(topic[group === 'positive' ? 'positiveRate' : 'improvementRate'])}<small>{topic[group]} response{topic[group] === 1 ? '' : 's'}</small></strong>
										</div>)}</div>
									</> : <p class="metrics-empty">No survey feedback in this period.</p>}
								</section>)}
								</>)}
							{tab() === "formula" && (<section class="metrics-section">
									<h2>Metric calculations</h2>
									<dl class="metrics-definitions">
										<div><dt>Bookable & booked slots</dt><dd>Bookable slots are published availability scheduled in the selected period, including slots subsequently booked or closed. Booked slots are distinct scheduled slots with a non-cancelled booking. Cancelled and replacement bookings do not count the same slot twice.</dd></div>
										<div><dt>Lesson surveys</dt><dd>Optional student feedback submitted within 48 hours of the lesson end, once per lesson. Survey charts use the selected lesson period. Topic percentage = surveys selecting that topic divided by submitted surveys, multiplied by 100. Students may select multiple topics, so percentages do not add up to 100. Comments are not included in tutor metrics. Overall tutor ratings include all recorded reviews and lesson survey ratings.</dd></div>
										<div>
											<dt>Attended lessons & teaching hours</dt>
											<dd>
												Ended, non-cancelled bookings with tutor
												attendance recorded Present, regardless of student attendance. Hours = scheduled
												minutes for these lessons &divide; 60.
											</dd>
										</div>
										<div>
											<dt>Tutor attendance</dt>
											<dd>
												Present &divide; (Present + Absent) &times; 100. Only
												ended, non-cancelled bookings count. Unverified
												attendance is reported separately.
											</dd>
										</div>
										<div>
											<dt>Cancellation/absence ratio</dt>
											<dd>Unique ended published slots affected by valid TA-301, TA-302 or TA-303 penalties divided by all ended published slots, multiplied by 100. Lower is better. Cancelled openings remain in the denominator. Each slot counts once, even after repeated penalties or rebooking. Future and unpublished slots, revoked penalties and corrected absences are excluded. TA-401 and TA-501 do not count as cancellation/absence incidents.</dd>
										</div>
										<div>
											<dt>Reliability</dt>
											<dd>
												max(0, (eligible slots &minus; penalty points) &divide;
												eligible slots &times; 100). Each ended booked or
												published unbooked slot counts once. Future slots and
												unpublished availability are excluded. TA-301/302
												attendance corrections and revoked penalties are
												excluded.
											</dd>
										</div>
										<div>
											<dt>Notes submission</dt>
											<dd>
												Submitted &divide; required ended lessons &times; 100.
												Unsubmitted updates remain pending. Absent and cancelled
												lessons need no notes. Overdue starts 48 hours after the
												scheduled end.
											</dd>
										</div>
										<div>
											<dt>Date range</dt>
											<dd>
												Lessons, eligible slots, and associated penalties use
												scheduled dates in Philippine Time. Rating totals are
												all time.
											</dd>
										</div>
									</dl>
									<h2>Penalty codes</h2>
									<dl class="metrics-definitions">
										{ready().penaltyReference.map((p) => (<div>
												<dt>
													{p.code} <small>{p.weight} points</small>
												</dt>
												<dd>{p.description}</dd>
											</div>))}
									</dl>
								</section>)}
						</>)}
				</main>
			</div>
		</>);
};
function Metric(_props0: {
    label: string;
    value: string | number;
    icon: string;
    tone?: string;
}) {
    return (<div class={`metrics-kpi ${_props0["tone"] === undefined ? "blue" : _props0["tone"]}`}>
			<TutorIcon name={`fi fi-sr-${_props0["icon"]}`} aria-hidden="true"/>
			<span>{_props0["label"]}</span>
			<strong>{_props0["value"]}</strong>
		</div>);
}
function Count(_props1: {
    label: string;
    value: string | number;
    tone?: string;
}) {
    return (<div class={`metrics-count ${_props1["tone"] === undefined ? "" : _props1["tone"]}`}>
			<strong>{_props1["value"]}</strong>
			<span>{_props1["label"]}</span>
		</div>);
}
function ActivityChart(_props2: {
    data: TutorPerformance;
}) {
    const max = createMemo(() => Math.max(1, ..._props2["data"].trend.map((d) => d.attended + d.tutorAbsent + d.studentAbsent + d.unverified)));
    return (<div class="metrics-chart-scroll">
			<div class="metrics-chart" role="img" aria-label="Lesson activity by scheduled date" style={cssStyle({
            get gridTemplateColumns() {
                return `repeat(${Math.max(1, _props2["data"].trend.length)}, minmax(20px, 1fr))`;
            }
        })}>
				{_props2["data"].trend.map((day, index) => (<div class="metrics-chart-column" title={`${day.date}: ${day.attended} attended, ${day.tutorAbsent} tutor absent, ${day.studentAbsent} student absent, ${day.unverified} unverified`}>
						<div class="metrics-chart-bar">
							{[
                ["green", day.attended],
                ["red", day.tutorAbsent],
                ["amber", day.studentAbsent],
                ["gray", day.unverified],
            ].map(([color, count]) => (<span class={String(color)} style={cssStyle({ get height() {
                        return `${(Number(count) / max()) * 100}%`;
                    } })}/>))}
						</div>
						<span class="metrics-chart-label">
							{_props2["data"].period.period === "all"
                ? day.date.slice(5)
                : index % 3 === 0 || index === _props2["data"].trend.length - 1
                    ? day.date.slice(8)
                    : ""}
						</span>
					</div>))}
			</div>
			{!_props2["data"].trend.some((d) => d.attended + d.tutorAbsent + d.studentAbsent + d.unverified) && (<p class="metrics-chart-empty">No ended lessons in this period.</p>)}
		</div>);
}
export default PerformanceMetricsPage;
