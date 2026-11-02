import {
	createSignal,
	createMemo,
	createEffect,
	onCleanup,
	Show,
	For,
} from "solid-js";
import { AlertTriangle, CheckCircle2, Send, X } from "lucide-solid";
import {
	lessonIssueReportApi,
	type LessonIssueReason,
	type StudentIssueReportStatus,
} from "../api/lessonIssueReport.api";
import {
	studentTutorIssues,
	type StudentTutorIssue,
} from "../data/studentTutorIssues";
import StudentDialog from "./Common/StudentDialog";
import "./StudentLessonIssueReport.css";
const reasons: { value: LessonIssueReason; label: string }[] = [
	{ value: "connection", label: "Internet connection problem" },
	{ value: "audio", label: "Audio or microphone problem" },
	{ value: "hardware", label: "Device problem" },
	{ value: "power", label: "Power interruption" },
	{ value: "emergency", label: "Health or personal emergency" },
	{ value: "tutor", label: "Tutor-related issue" },
	{ value: "material", label: "Lesson material problem" },
	{ value: "other", label: "Other lesson issue" },
];
export default function StudentLessonIssueReport(props: {
	bookingId: string;
	compact?: boolean;
	presenceRevision?: string;
}) {
	const [status, setStatus] = createSignal<StudentIssueReportStatus | null>(
			null,
		),
		[error, setError] = createSignal("");
	const [open, setOpen] = createSignal(false),
		[busy, setBusy] = createSignal(false),
		[reason, setReason] = createSignal<LessonIssueReason>("tutor");
	const [issue, setIssue] = createSignal<StudentTutorIssue | null>(null),
		[details, setDetails] = createSignal(""),
		[now, setNow] = createSignal(Date.now());
	let offset = 0;
	createEffect(() => {
		const id = props.bookingId;
		props.presenceRevision;
		const controller = new AbortController();
		const load = async () => {
			try {
				const r = await lessonIssueReportApi.get(id, controller.signal);
				if (!controller.signal.aborted) {
					offset = Date.parse(r.serverNow) - Date.now();
					setStatus(r);
					setError("");
				}
			} catch {
				if (!controller.signal.aborted)
					setError("Reporting availability could not be loaded.");
			}
		};
		setStatus(null);
		void load();
		const refresh = setInterval(() => void load(), 10000),
			clock = setInterval(() => setNow(Date.now()), 1000);
		onCleanup(() => {
			controller.abort();
			clearInterval(refresh);
			clearInterval(clock);
		});
	});
	const ongoing = createMemo(
		() => !!status() && now() + offset < Date.parse(status()!.lessonEndsAt),
	);
	const available = createMemo(
		() =>
			!!status()?.eligible &&
			!status()?.report &&
			now() + offset >=
				Date.parse(status()?.availableAt || status()!.startsAt) &&
			now() + offset < Date.parse(status()!.closesAt),
	);
	const choices = createMemo(() =>
		studentTutorIssues.filter(
			(i) =>
				!ongoing() || ["no_show", "late_join", "left_early"].includes(i.value),
		),
	);
	const needsDetails = createMemo(
		() => reason() === "other" || (reason() === "tutor" && issue() === "other"),
	);
	return (
		<>
			<div
				class={`student-issue-report-control${props.compact ? " classroom-report-control" : ""}`}
			>
				<button
					type="button"
					class="student-report-issue-button"
					disabled={!available()}
					onClick={() => {
						setReason("tutor");
						setIssue(null);
						setDetails("");
						setOpen(true);
					}}
				>
					{status()?.report ? (
						<CheckCircle2 size={16} />
					) : (
						<AlertTriangle size={16} />
					)}{" "}
					{status()?.report ? "Issue reported" : "Report issue"}
				</button>
				<Show when={!props.compact}>
					<p role="status">
						{status()?.report
							? "Your report was submitted. Staff will send updates to your inbox."
							: available()
								? "One report per lesson. Reports cannot be edited."
								: "Reporting opens two minutes after the lesson starts and closes 48 hours after it ends."}
					</p>
				</Show>
				<Show when={error()}>
					<p role="alert">{error()}</p>
				</Show>
			</div>
			<Show when={open()}>
				<StudentDialog
					className="student-issue-report-dialog"
					label="Report a lesson issue"
					busy={busy()}
					onClose={() => !busy() && setOpen(false)}
				>
					<form
						onSubmit={async (e) => {
							e.preventDefault();
							if (busy() || !available() || (reason() === "tutor" && !issue()))
								return;
							setBusy(true);
							setError("");
							try {
								const report = await lessonIssueReportApi.submit(
									props.bookingId,
									undefined,
									reason(),
									details(),
									reason() === "tutor" ? issue()! : undefined,
								);
								setStatus((s) => s && { ...s, report, eligible: false });
								setOpen(false);
								window.dispatchEvent(new Event("lesson-issue-updated"));
							} catch (e: any) {
								setError(
									e.response?.data?.error ||
										e.message ||
										"Could not submit report.",
								);
							} finally {
								setBusy(false);
							}
						}}
					>
						<header>
							<h2>Report a lesson issue</h2>
							<button
								type="button"
								aria-label="Close report"
								disabled={busy()}
								onClick={() => setOpen(false)}
							>
								<X size={20} />
							</button>
						</header>
						<div class="student-issue-report-body">
							<p>
								You can send one report for this lesson. Include the full
								details; you cannot edit or send another report. Staff handle
								the case privately.
							</p>
							<fieldset disabled={busy()}>
								<legend>What happened?</legend>
								<Show when={!ongoing()}>
									<div class="student-issue-reasons">
										<For each={reasons}>
											{(r) => (
												<label>
													<input
														type="radio"
														name="reason"
														checked={reason() === r.value}
														onChange={() => {
															setReason(r.value);
															setIssue(null);
														}}
													/>
													{r.label}
												</label>
											)}
										</For>
									</div>
								</Show>
								<Show when={reason() === "tutor"}>
									<div class="student-issue-reasons student-tutor-issues">
										<For each={choices()}>
											{(i) => (
												<label>
													<input
														type="radio"
														name="issue"
														checked={issue() === i.value}
														onChange={() => setIssue(i.value)}
													/>
													{ongoing() && i.value === "no_show"
														? "Tutor has not joined"
														: ongoing() && i.value === "left_early"
															? "Tutor left / is no longer available"
															: i.label}
												</label>
											)}
										</For>
									</div>
								</Show>
								<label class="student-issue-details">
									Details ({needsDetails() ? "required" : "optional"})
									<textarea
										rows={5}
										maxLength={2000}
										required={needsDetails()}
										value={details()}
										onInput={(e) => setDetails(e.currentTarget.value)}
									/>
								</label>
							</fieldset>
							<Show when={error()}>
								<p role="alert">{error()}</p>
							</Show>
						</div>
						<footer>
							<button
								type="button"
								disabled={busy()}
								onClick={() => setOpen(false)}
							>
								Cancel
							</button>
							<button
								type="submit"
								class="student-issue-submit"
								disabled={
									busy() || !available() || (reason() === "tutor" && !issue())
								}
							>
								<Send size={16} />
								{busy() ? "Sending..." : "Send report"}
							</button>
						</footer>
					</form>
				</StudentDialog>
			</Show>
		</>
	);
}
