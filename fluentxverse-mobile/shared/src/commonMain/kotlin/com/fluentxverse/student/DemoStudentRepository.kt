package com.fluentxverse.student

/** In-memory fixtures shared by Android and iOS. Recreating the repository resets the demo account. */
class DemoStudentRepository(dayStartEpochMillis: Long) : StudentRepository {
    private var state = DemoStudentData.create(dayStartEpochMillis)
    private var bookingSequence = 1

    override fun snapshot(): StudentSnapshot = state

    override fun searchTutors(query: String, favoritesOnly: Boolean): List<Tutor> {
        val term = query.trim()
        return state.tutors.filter { tutor ->
            (!favoritesOnly || tutor.tutorId in state.favoriteTutorIds) &&
                listOf(tutor.name, tutor.country, tutor.specialty).any { it.contains(term, ignoreCase = true) }
        }
    }

    override fun availableSlots(tutorId: String, nowEpochMillis: Long): List<LessonSlot> =
        state.slots.filter { slot ->
            slot.tutorId == tutorId && slot.startsAtEpochMillis > nowEpochMillis &&
                state.upcomingLessons.none { it.slot.slotId == slot.slotId || overlaps(it.slot, slot) }
        }.sortedBy { it.startsAtEpochMillis }

    override fun toggleFavorite(tutorId: String) {
        if (state.tutors.none { it.tutorId == tutorId }) return
        state = state.copy(favoriteTutorIds = if (tutorId in state.favoriteTutorIds) {
            state.favoriteTutorIds - tutorId
        } else {
            state.favoriteTutorIds + tutorId
        })
    }

    override fun markMessageRead(messageId: String) {
        state = state.copy(messages = state.messages.map {
            if (it.messageId == messageId) it.copy(isRead = true) else it
        })
    }

    override fun bookLesson(slotId: String, materialId: String?, nowEpochMillis: Long): StudentActionResult {
        val slot = state.slots.find { it.slotId == slotId }
            ?: return StudentActionResult(false, "This time is no longer available.")
        val tutor = state.tutors.find { it.tutorId == slot.tutorId }
            ?: return StudentActionResult(false, "Tutor could not be found.")
        if (slot !in availableSlots(tutor.tutorId, nowEpochMillis)) {
            return StudentActionResult(false, "This time is unavailable or overlaps another lesson.")
        }
        if (state.tickets.count(tutor.tier) == 0) {
            return StudentActionResult(false, "You do not have a ${tutor.tier.name.lowercase()} ticket.")
        }
        val material = materialId?.let { id -> state.materials.find { it.materialId == id } }
        if (materialId != null && material == null) {
            return StudentActionResult(false, "Choose an available learning material.")
        }
        val booking = LessonBooking(
            bookingId = "demo-booking-${bookingSequence++}",
            slot = slot,
            tutorName = tutor.name,
            topic = material?.title ?: "Free conversation",
            tier = tutor.tier,
            status = LessonStatus.UPCOMING,
        )
        state = state.copy(
            tickets = state.tickets.adjust(tutor.tier, -1),
            bookings = state.bookings + booking,
        )
        return StudentActionResult(true, "Demo lesson booked. Your schedule has been updated.")
    }

    override fun cancelLesson(bookingId: String, nowEpochMillis: Long): StudentActionResult {
        val booking = state.bookings.find { it.bookingId == bookingId }
            ?: return StudentActionResult(false, "Lesson could not be found.")
        if (booking.status != LessonStatus.UPCOMING || booking.slot.startsAtEpochMillis <= nowEpochMillis) {
            return StudentActionResult(false, "This lesson cannot be cancelled.")
        }
        state = state.copy(
            tickets = state.tickets.adjust(booking.tier, 1),
            bookings = state.bookings.map {
                if (it.bookingId == bookingId) it.copy(status = LessonStatus.CANCELLED) else it
            },
        )
        return StudentActionResult(true, "Demo lesson cancelled. Your ticket has been returned.")
    }

    private fun overlaps(first: LessonSlot, second: LessonSlot): Boolean =
        first.startsAtEpochMillis < second.endsAtEpochMillis && second.startsAtEpochMillis < first.endsAtEpochMillis
}
