import { client } from "./utils";

export type MetricsPeriod = "month" | "30days" | "all";
export type MetricOutcome =
	| "attended"
	| "tutor_absent"
	| "student_absent"
	| "awaiting_verification"
	| "upcoming"
	| "ongoing"
	| "cancelled"
	| "unclassified";
export interface TutorPerformance {
	period: {
		period: MetricsPeriod;
		month: string | null;
		from: string | null;
		to: string | null;
	};
	timezone: string;
	generatedAt: string;
	slots: { bookable: number; booked: number };
	lessons: Record<MetricOutcome, number> & {
		total: number;
		teachingMinutes: number;
		teachingHours: number;
	};
	attendance: {
		present: number;
		absent: number;
		unverified: number;
		rate: number | null;
	};
	notes: {
		submitted: number;
		pendingUpdates: number;
		drafts: number;
		overdue: number;
		notRequired: number;
		onTime: number;
		submissionRate: number | null;
	};
	cancellation: {
		rate: number | null;
		affectedSlots: number;
		eligibleSlots: number;
	};
	reliability: {
		score: number | null;
		eligibleSlots: number;
		bookedSlots: number;
		unbookedSlots: number;
		penaltyPoints: number;
		penaltyCounts: Record<string, number>;
		weights: Record<string, number>;
	};
	trend: {
		date: string;
		attended: number;
		tutorAbsent: number;
		studentAbsent: number;
		unverified: number;
		minutes: number;
	}[];
	recentLessons: {
		bookingId: string;
		startsAt: string | null;
		durationMinutes: number;
		studentName: string;
		outcome: MetricOutcome;
		notesStatus: string;
	}[];
	page: number;
	pageSize: number;
	totalPages: number;
	penalties: {
		id: string;
		bookingId: string | null;
		code: string;
		reason: string;
		createdAt: string | null;
		startsAt: string | null;
		points: number;
		excludedFromScore: boolean;
	}[];
	penaltyTotal: number;
	rating: {
		average: number | null;
		totalReviews: number;
		scope: string;
		distribution: null;
	};
	survey: {
		total: number;
		average: number | null;
		distribution: { rating: number; count: number }[];
		topics: { id: string; label: string; positiveEnabled: boolean; positive: number; improvement: number;
			positiveRate: number | null; improvementRate: number | null }[];
	};
	penaltyReference: { code: string; description: string; weight: number }[];
}
export const currentPhtMonth = () =>
	new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 7);
export async function getTutorPerformance(
	period: MetricsPeriod,
	month?: string,
	page = 1,
	signal?: AbortSignal,
): Promise<TutorPerformance> {
	const response = await client.get("/tutor/performance", {
		params: { period, month: period === "month" ? month : undefined, page },
		signal,
	});
	if (!response.data.success || !response.data.data?.lessons)
		throw new Error(
			response.data.error || "Could not load performance metrics",
		);
	return response.data.data;
}
