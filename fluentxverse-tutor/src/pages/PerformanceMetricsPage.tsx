import { useEffect, useState } from "preact/hooks";
import {
	getTutorPerformance,
	currentPhtMonth,
	type MetricsPeriod,
	type MetricOutcome,
	type TutorPerformance,
} from "../api/performance.api";
import SideBar from "../Components/IndexOne/SideBar";
import DashboardHeader from "../Components/Dashboard/DashboardHeader";
import "./PerformanceMetricsPage.css";

type Tab = "lessons" | "rating" | "reliability" | "formula";
const tabs: { id: Tab; label: string; icon: string }[] = [
	{ id: "lessons", label: "Lessons", icon: "book-alt" },
	{
		id: "reliability",
		label: "Attendance & reliability",
		icon: "shield-check",
	},
	{ id: "rating", label: "Rating", icon: "star" },
	{ id: "formula", label: "Calculations", icon: "calculator" },
];
const outcomes: { id: MetricOutcome; label: string; tone: string }[] = [
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
	not_due: "Not due",
};
const percent = (value: number | null) =>
	value === null ? "No data" : `${value}%`;
const time = (date: string | null) =>
	date && Number.isFinite(Date.parse(date))
		? new Date(date).toLocaleString("en-US", {
				timeZone: "Asia/Manila",
				month: "short",
				day: "numeric",
				year: "numeric",
				hour: "numeric",
				minute: "2-digit",
			})
		: "Not recorded";
const initialTab = (): Tab =>
	tabs.some((t) => t.id === window.location.hash.slice(1))
		? (window.location.hash.slice(1) as Tab)
		: "lessons";

export const PerformanceMetricsPage = () => {
	const [tab, setTab] = useState<Tab>(initialTab);
	const [period, setPeriod] = useState<MetricsPeriod>(() => {
		const value = new URLSearchParams(window.location.search).get("period");
		return value === "all" || value === "30days" ? value : "month";
	});
	const [month, setMonth] = useState(currentPhtMonth);
	const [page, setPage] = useState(1);
	const [data, setData] = useState<TutorPerformance | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const [revision, setRevision] = useState(0);
	useEffect(() => {
		document.title = "Performance Metrics | FluentXVerse";
		const focus = () => {
			if (!document.hidden) setRevision((n) => n + 1);
		};
		const hash = () => setTab(initialTab());
		const timer = window.setInterval(focus, 60_000);
		window.addEventListener("focus", focus);
		window.addEventListener("hashchange", hash);
		return () => {
			clearInterval(timer);
			window.removeEventListener("focus", focus);
			window.removeEventListener("hashchange", hash);
		};
	}, []);
	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError("");
		getTutorPerformance(period, month, page, controller.signal)
			.then((value) => {
				if (!controller.signal.aborted) setData(value);
			})
			.catch((err) => {
				if (!controller.signal.aborted) {
					setData(null);
					setError(
						err.response?.data?.error ||
							err.message ||
							"Could not load performance metrics",
					);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [period, month, page, revision]);
	const selectTab = (value: Tab) => {
		setTab(value);
		window.history.replaceState(
			window.history.state,
			"",
			`${window.location.pathname}${window.location.search}#${value}`,
		);
	};
	const ready =
		data &&
		data.period.period === period &&
		(period !== "month" || data.period.month === month) &&
		data.page === page
			? data
			: null;
	return (
		<>
			<SideBar />
			<div className="main-content">
				<DashboardHeader />
				<main className="performance-metrics-page">
					<header className="metrics-header">
						<div>
							<a href="/profile" className="metrics-back">
								<i className="fi fi-sr-arrow-left" aria-hidden="true" />
								Profile
							</a>
							<h1>
								<i className="fi fi-sr-chart-histogram" aria-hidden="true" />
								Performance Metrics
							</h1>
						</div>
						<div className="metrics-controls">
							<label>
								Period
								<select
									aria-label="Metrics period"
									value={period}
									onChange={(e) => {
										setPeriod(e.currentTarget.value as MetricsPeriod);
										setPage(1);
									}}
								>
									<option value="month">Month</option>
									<option value="30days">Last 30 days</option>
									<option value="all">All time</option>
								</select>
							</label>
							{period === "month" && (
								<label>
									Month
									<input
										aria-label="Metrics month"
										type="month"
										min="2000-01"
										max={currentPhtMonth()}
										value={month}
										onChange={(e) => {
											if (e.currentTarget.value) {
												setMonth(e.currentTarget.value);
												setPage(1);
											}
										}}
									/>
								</label>
							)}
							<button
								type="button"
								className="metrics-icon-button"
								title="Refresh metrics"
								aria-label="Refresh metrics"
								disabled={loading}
								onClick={() => setRevision((n) => n + 1)}
							>
								<i className="fi fi-sr-refresh" aria-hidden="true" />
							</button>
						</div>
					</header>
					<div className="metrics-meta">
						<span>Philippine Time (PHT)</span>
						<span>
							{loading
								? "Updating..."
								: ready
									? `Updated ${time(ready.generatedAt)}`
									: "Not available"}
						</span>
					</div>
					{error && (
						<div className="metrics-error" role="alert">
							{error}
							<button type="button" onClick={() => setRevision((n) => n + 1)}>
								Retry
							</button>
						</div>
					)}
					{!ready && loading && (
						<div className="metrics-loading" role="status">
							Loading metrics...
						</div>
					)}
					{ready && (
						<>
							<section
								className="metrics-overview"
								aria-label="Performance summary"
							>
								<div className="metrics-overview-card metrics-scheduling-card">
									<h2><i className="fi fi-sr-calendar" aria-hidden="true" />Scheduling</h2>
									<div className="metrics-kpis">
										<Metric label="Bookable slots" value={ready.slots?.bookable ?? '--'} icon="calendar" />
										<Metric label="Booked slots" value={ready.slots?.booked ?? '--'} icon="book-alt" tone="green" />
									</div>
								</div>
								<div className="metrics-overview-card">
								<h2><i className="fi fi-sr-book-alt" aria-hidden="true" />Teaching</h2>
								<div className="metrics-kpis">
								<Metric
									label="Attended lessons"
									value={ready.lessons.attended}
									icon="check"
									tone="green"
								/>
								<Metric
									label="Teaching hours"
									value={ready.lessons.teachingHours}
									icon="clock"
								/>
								</div></div>
								<div className="metrics-overview-card">
								<h2><i className="fi fi-sr-shield-check" aria-hidden="true" />Attendance & notes</h2>
								<div className="metrics-kpis metrics-quality-stats">
								<Metric
									label="Tutor attendance"
									value={percent(ready.attendance.rate)}
									icon="calendar"
									tone="teal"
								/>
								<Metric
									label="Reliability"
									value={percent(ready.reliability.score)}
									icon="shield-check"
									tone="amber"
								/>
								<Metric
									label="Cancellation/absence ratio"
									value={percent(ready.cancellation?.rate ?? null)}
									icon="calendar"
									tone="red"
								/>
								<Metric
									label="Notes overdue"
									value={ready.notes.overdue}
									icon="document"
									tone={ready.notes.overdue ? "red" : "gray"}
								/>
								</div></div>
							</section>
							<nav className="metrics-tabs" aria-label="Performance views">
								{tabs.map((item) => (
									<button
										key={item.id}
										type="button"
										aria-current={tab === item.id ? "page" : undefined}
										className={tab === item.id ? "active" : ""}
										onClick={() => selectTab(item.id)}
									>
										<i className={`fi fi-sr-${item.icon}`} aria-hidden="true" />
										{item.label}
									</button>
								))}
							</nav>
							{tab === "lessons" && (
								<>
									<section className="metrics-section">
										<h2>Lesson outcomes</h2>
										<div className="metrics-outcomes">
											{outcomes
												.filter(
													(o) =>
														o.id !== "unclassified" ||
														ready.lessons.unclassified,
												)
												.map((o) => (
													<div key={o.id}>
														<span className={`metrics-dot ${o.tone}`} />
														<span>{o.label}</span>
														<strong>{ready.lessons[o.id]}</strong>
													</div>
												))}
										</div>
									</section>
									<section className="metrics-section">
										<div className="metrics-section-heading">
											<h2>
												{period === "all"
													? "Last 12 months"
													: "Daily lesson activity"}
											</h2>
											<div className="metrics-legend">
												<span>
													<i className="metrics-dot green" />
													Attended
												</span>
												<span>
													<i className="metrics-dot red" />
													Tutor absent
												</span>
												<span>
													<i className="metrics-dot amber" />
													Student absent
												</span>
												<span>
													<i className="metrics-dot gray" />
													Unverified
												</span>
											</div>
										</div>
										<ActivityChart data={ready} />
									</section>
									<section className="metrics-section">
										<h2>Lesson notes</h2>
										<div className="metrics-inline-stats">
											<Count label="Submitted" value={ready.notes.submitted} />
											<Count
												label="Updates pending"
												value={ready.notes.pendingUpdates}
											/>
											<Count label="Not submitted" value={ready.notes.drafts} />
											<Count
												label="Overdue"
												value={ready.notes.overdue}
												tone="red"
											/>
											<Count
												label="Not required"
												value={ready.notes.notRequired}
											/>
											<Count
												label="Submission rate"
												value={percent(ready.notes.submissionRate)}
											/>
										</div>
									</section>
									<section className="metrics-section">
										<div className="metrics-section-heading">
											<h2>Booked lessons</h2>
											<span>{ready.lessons.total} total</span>
										</div>
										{!ready.recentLessons.length ? (
											<p className="metrics-empty">
												No booked lessons in this period.
											</p>
										) : (
											<div className="metrics-table-scroll">
												<table className="metrics-table">
													<thead>
														<tr>
															<th>Date & time (PHT)</th>
															<th>Student</th>
															<th>Duration</th>
															<th>Outcome</th>
															<th>Notes</th>
															<th>
																<span className="metrics-sr-only">Lesson</span>
															</th>
														</tr>
													</thead>
													<tbody>
														{ready.recentLessons.map((lesson) => {
															const outcome = outcomes.find(
																(o) => o.id === lesson.outcome,
															)!;
															return (
																<tr key={lesson.bookingId}>
																	<td>{time(lesson.startsAt)}</td>
																	<td>{lesson.studentName}</td>
																	<td>{lesson.durationMinutes} min</td>
																	<td>
																		<span
																			className={`metrics-status ${outcome.tone}`}
																		>
																			{outcome.label}
																		</span>
																	</td>
																	<td>
																		{noteLabels[lesson.notesStatus] ||
																			lesson.notesStatus}
																	</td>
																	<td>
																		<a
																			href={`/lesson/${encodeURIComponent(lesson.bookingId)}`}
																			className="metrics-icon-button"
																			title="Open lesson"
																			aria-label={`Open lesson with ${lesson.studentName}`}
																		>
																			<i
																				className="fi fi-sr-arrow-right"
																				aria-hidden="true"
																			/>
																		</a>
																	</td>
																</tr>
															);
														})}
													</tbody>
												</table>
											</div>
										)}
										{ready.totalPages > 1 && (
											<div className="metrics-pagination">
												<span>
													Page {ready.page} of {ready.totalPages}
												</span>
												<button
													type="button"
													className="metrics-icon-button"
													aria-label="Previous page"
													title="Previous page"
													disabled={page <= 1 || loading}
													onClick={() => setPage((n) => n - 1)}
												>
													<i
														className="fi fi-sr-angle-left"
														aria-hidden="true"
													/>
												</button>
												<button
													type="button"
													className="metrics-icon-button"
													aria-label="Next page"
													title="Next page"
													disabled={page >= ready.totalPages || loading}
													onClick={() => setPage((n) => n + 1)}
												>
													<i
														className="fi fi-sr-angle-right"
														aria-hidden="true"
													/>
												</button>
											</div>
										)}
									</section>
								</>
							)}
							{tab === "reliability" && (
								<>
									<section className="metrics-section">
										<h2>Tutor attendance</h2>
										<div className="metrics-inline-stats">
											<Count
												label="Present"
												value={ready.attendance.present}
												tone="green"
											/>
											<Count
												label="Absent"
												value={ready.attendance.absent}
												tone="red"
											/>
											<Count
												label="Unverified"
												value={ready.attendance.unverified}
											/>
											<Count
												label="Verified attendance rate"
												value={percent(ready.attendance.rate)}
											/>
										</div>
									</section>
									<section className="metrics-section">
										<h2>Cancellation/absence ratio</h2>
										<div className="metrics-inline-stats">
											<Count label="Affected slots" value={ready.cancellation?.affectedSlots ?? '--'} tone="red" />
											<Count label="Ended published slots" value={ready.cancellation?.eligibleSlots ?? '--'} />
											<Count label="Ratio (lower is better)" value={percent(ready.cancellation?.rate ?? null)} />
										</div>
									</section>
									<section className="metrics-section">
										<h2>Reliability</h2>
										<div className="metrics-score">
											<strong>{percent(ready.reliability.score)}</strong>
											<progress
												aria-label="Reliability score"
												max={100}
												value={ready.reliability.score || 0}
											/>
										</div>
										<div className="metrics-inline-stats">
											<Count
												label="Eligible booked slots"
												value={ready.reliability.bookedSlots}
											/>
											<Count
												label="Eligible unbooked slots"
												value={ready.reliability.unbookedSlots}
											/>
											<Count
												label="Penalty points"
												value={ready.reliability.penaltyPoints}
												tone="red"
											/>
										</div>
										<dl className="metrics-penalty-counts">
											{Object.entries(ready.reliability.weights).map(
												([code, weight]) => (
													<div key={code}>
														<dt>TA-{code}</dt>
														<dd>
															{ready.reliability.penaltyCounts[code] || 0}{" "}
															incidents <span>&times; {weight} points</span>
														</dd>
													</div>
												),
											)}
										</dl>
									</section>
									<section className="metrics-section">
										<div className="metrics-section-heading">
											<h2>Recent penalty records</h2>
											<span>{ready.penaltyTotal} records</span>
										</div>
										{!ready.penalties.length ? (
											<p className="metrics-empty">
												No penalty records in this period.
											</p>
										) : (
											<ul className="metrics-incidents">
												{ready.penalties.map((p) => (
													<li key={p.id}>
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
														{p.bookingId && (
															<a
																className="metrics-icon-button"
																href={`/lesson/${encodeURIComponent(p.bookingId)}`}
																title="Open lesson"
																aria-label="Open penalty lesson"
															>
																<i
																	className="fi fi-sr-arrow-right"
																	aria-hidden="true"
																/>
															</a>
														)}
													</li>
												))}
											</ul>
										)}
									</section>
								</>
							)}
							{tab === "rating" && (
								<>
								<section className="metrics-section">
									<h2>
										Student ratings <small>All time</small>
									</h2>
									<div className="metrics-inline-stats">
										<Count
											label="Average rating"
											value={
												ready.rating.average === null
													? "No ratings"
													: `${ready.rating.average.toFixed(1)} / 5`
											}
											tone="amber"
										/>
										<Count
											label="Recorded reviews"
											value={ready.rating.totalReviews}
										/>
									</div>
								</section>
								<section className="metrics-section">
									<h2>Lesson surveys <small>Selected period</small></h2>
									<div className="metrics-inline-stats">
										<Count label="Submitted surveys" value={ready.survey?.total ?? 0} />
										<Count label="Overall lesson rating" value={ready.survey?.average == null ? 'No ratings' : `${ready.survey.average.toFixed(1)} / 5`} tone="amber" />
									</div>
									{ready.survey?.total ? <div className="metrics-survey-bars" aria-label="Lesson rating distribution">
										{[...ready.survey.distribution].reverse().map(item => <div key={item.rating} className="metrics-survey-row">
											<span>{item.rating} star{item.rating > 1 ? 's' : ''}</span><progress aria-label={`${item.rating}-star ratings`} max={ready.survey.total} value={item.count} /><strong>{item.count}</strong>
										</div>)}
									</div> : <p className="metrics-empty">No lesson surveys submitted in this period.</p>}
								</section>
								{(['positive', 'improvement'] as const).map(group => <section className={`metrics-section metrics-survey-${group}`} key={group}>
									<h2>{group === 'positive' ? 'Satisfaction points' : 'Areas for improvement'}</h2>
									{ready.survey?.total ? <>
										<p className="metrics-survey-caption">Share of {ready.survey.total} submitted survey{ready.survey.total === 1 ? '' : 's'} in the selected period</p>
										<div className="metrics-survey-bars">{ready.survey.topics.filter(topic => group === 'improvement' || topic.positiveEnabled).map(topic => <div key={topic.id} className="metrics-survey-row">
											<span>{topic.label}</span><progress aria-label={`${topic.label}: ${group === 'positive' ? 'satisfaction' : 'improvement'}`} max={100} value={topic[group === 'positive' ? 'positiveRate' : 'improvementRate'] || 0} /><strong>{percent(topic[group === 'positive' ? 'positiveRate' : 'improvementRate'])}<small>{topic[group]} response{topic[group] === 1 ? '' : 's'}</small></strong>
										</div>)}</div>
									</> : <p className="metrics-empty">No survey feedback in this period.</p>}
								</section>)}
								</>
							)}
							{tab === "formula" && (
								<section className="metrics-section">
									<h2>Metric calculations</h2>
									<dl className="metrics-definitions">
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
									<dl className="metrics-definitions">
										{ready.penaltyReference.map((p) => (
											<div key={p.code}>
												<dt>
													{p.code} <small>{p.weight} points</small>
												</dt>
												<dd>{p.description}</dd>
											</div>
										))}
									</dl>
								</section>
							)}
						</>
					)}
				</main>
			</div>
		</>
	);
};
function Metric({
	label,
	value,
	icon,
	tone = "blue",
}: {
	label: string;
	value: string | number;
	icon: string;
	tone?: string;
}) {
	return (
		<div className={`metrics-kpi ${tone}`}>
			<i className={`fi fi-sr-${icon}`} aria-hidden="true" />
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
}
function Count({
	label,
	value,
	tone = "",
}: {
	label: string;
	value: string | number;
	tone?: string;
}) {
	return (
		<div className={`metrics-count ${tone}`}>
			<strong>{value}</strong>
			<span>{label}</span>
		</div>
	);
}
function ActivityChart({ data }: { data: TutorPerformance }) {
	const max = Math.max(
		1,
		...data.trend.map(
			(d) => d.attended + d.tutorAbsent + d.studentAbsent + d.unverified,
		),
	);
	return (
		<div className="metrics-chart-scroll">
			<div
				className="metrics-chart"
				role="img"
				aria-label="Lesson activity by scheduled date"
				style={{
					gridTemplateColumns: `repeat(${Math.max(1, data.trend.length)}, minmax(20px, 1fr))`,
				}}
			>
				{data.trend.map((day, index) => (
					<div
						key={day.date}
						className="metrics-chart-column"
						title={`${day.date}: ${day.attended} attended, ${day.tutorAbsent} tutor absent, ${day.studentAbsent} student absent, ${day.unverified} unverified`}
					>
						<div className="metrics-chart-bar">
							{[
								["green", day.attended],
								["red", day.tutorAbsent],
								["amber", day.studentAbsent],
								["gray", day.unverified],
							].map(([color, count]) => (
								<span
									key={String(color)}
									className={String(color)}
									style={{ height: `${(Number(count) / max) * 100}%` }}
								/>
							))}
						</div>
						<span className="metrics-chart-label">
							{data.period.period === "all"
								? day.date.slice(5)
								: index % 3 === 0 || index === data.trend.length - 1
									? day.date.slice(8)
									: ""}
						</span>
					</div>
				))}
			</div>
			{!data.trend.some(
				(d) => d.attended + d.tutorAbsent + d.studentAbsent + d.unverified,
			) && (
				<p className="metrics-chart-empty">No ended lessons in this period.</p>
			)}
		</div>
	);
}
export default PerformanceMetricsPage;
