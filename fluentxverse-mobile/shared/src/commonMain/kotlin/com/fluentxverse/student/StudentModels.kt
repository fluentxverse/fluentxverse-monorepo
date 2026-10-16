package com.fluentxverse.student

enum class TicketTier { BASIC, PREMIUM, TRIAL }
enum class LessonStatus { UPCOMING, COMPLETED, CANCELLED }

data class StudentProfile(
    val userId: String,
    val givenName: String,
    val email: String,
    val level: String,
    val timeZone: String,
)

data class TicketBalance(val basic: Int, val premium: Int, val trial: Int) {
    val total: Int get() = basic + premium + trial
    fun count(tier: TicketTier): Int = when (tier) {
        TicketTier.BASIC -> basic
        TicketTier.PREMIUM -> premium
        TicketTier.TRIAL -> trial
    }

    internal fun adjust(tier: TicketTier, amount: Int): TicketBalance {
        require(count(tier) + amount >= 0)
        return when (tier) {
            TicketTier.BASIC -> copy(basic = basic + amount)
            TicketTier.PREMIUM -> copy(premium = premium + amount)
            TicketTier.TRIAL -> copy(trial = trial + amount)
        }
    }
}

data class Tutor(
    val tutorId: String,
    val name: String,
    val country: String,
    val specialty: String,
    val introduction: String,
    val rating: String,
    val tier: TicketTier,
)

data class LessonSlot(
    val slotId: String,
    val tutorId: String,
    val startsAtEpochMillis: Long,
    val durationMinutes: Int,
) {
    val endsAtEpochMillis: Long get() = startsAtEpochMillis + durationMinutes * 60_000L
}

data class LessonBooking(
    val bookingId: String,
    val slot: LessonSlot,
    val tutorName: String,
    val topic: String,
    val tier: TicketTier,
    val status: LessonStatus,
)

data class LearningMaterial(
    val materialId: String,
    val title: String,
    val subtitle: String,
    val level: String,
    val imageKey: String,
    val introduction: String,
    val vocabulary: List<String>,
    val discussion: List<String>,
)

data class StudentMessage(
    val messageId: String,
    val sender: String,
    val subject: String,
    val body: String,
    val isRead: Boolean,
)

data class StudentSnapshot(
    val profile: StudentProfile,
    val tickets: TicketBalance,
    val tutors: List<Tutor>,
    val slots: List<LessonSlot>,
    val bookings: List<LessonBooking>,
    val materials: List<LearningMaterial>,
    val messages: List<StudentMessage>,
    val favoriteTutorIds: List<String>,
) {
    val upcomingLessons: List<LessonBooking>
        get() = bookings.filter { it.status == LessonStatus.UPCOMING }.sortedBy { it.slot.startsAtEpochMillis }
    val lessonsCompleted: Int get() = bookings.count { it.status == LessonStatus.COMPLETED }
    val unreadMessages: Int get() = messages.count { !it.isRead }
}

data class StudentActionResult(val success: Boolean, val message: String)
