package com.fluentxverse.student

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DemoStudentRepositoryTest {
    private val now = 1_800_000_000_000L
    private fun repository() = DemoStudentRepository(now)

    @Test fun bookingConsumesOnlyTheMatchingTicketAndRejectsDuplicateBooking() {
        val repository = repository()
        val slot = repository.availableSlots("daniel", now).first()
        assertTrue(repository.bookLesson(slot.slotId, "business", now).success)
        assertEquals(TicketBalance(4, 1, 1), repository.snapshot().tickets)
        assertEquals("Business English", repository.snapshot().upcomingLessons.last { it.slot == slot }.topic)
        assertFalse(repository.bookLesson(slot.slotId, null, now).success)
        assertEquals(TicketBalance(4, 1, 1), repository.snapshot().tickets)
    }

    @Test fun exhaustedTicketsCannotCreateABooking() {
        val repository = repository()
        repository.availableSlots("daniel", now).take(2).forEach {
            assertTrue(repository.bookLesson(it.slotId, null, now).success)
        }
        val slot = repository.availableSlots("daniel", now).first()
        assertFalse(repository.bookLesson(slot.slotId, null, now).success)
        assertEquals(0, repository.snapshot().tickets.premium)
        assertEquals(3, repository.snapshot().upcomingLessons.size)
    }

    @Test fun cancellingReturnsATicketOnlyOnceAndReopensTheSlot() {
        val repository = repository()
        assertTrue(repository.cancelLesson("demo-next", now).success)
        assertEquals(5, repository.snapshot().tickets.basic)
        assertEquals(3, repository.availableSlots("maya", now).size)
        assertFalse(repository.cancelLesson("demo-next", now).success)
        assertEquals(5, repository.snapshot().tickets.basic)
    }

    @Test fun pastSlotsAndStartedLessonsCannotBeChanged() {
        val repository = repository()
        val next = repository.snapshot().upcomingLessons.first()
        assertFalse(repository.cancelLesson(next.bookingId, next.slot.startsAtEpochMillis).success)
        val slot = repository.snapshot().slots.last()
        assertFalse(repository.bookLesson(slot.slotId, null, slot.startsAtEpochMillis).success)
        assertTrue(repository.availableSlots("maya", now + 10 * 86_400_000L).isEmpty())
    }

    @Test fun invalidMaterialDoesNotConsumeATicket() {
        val repository = repository()
        val before = repository.snapshot()
        val slot = repository.availableSlots("aiko", now).first()
        assertFalse(repository.bookLesson(slot.slotId, "missing", now).success)
        assertEquals(before, repository.snapshot())
    }

    @Test fun tutorSearchFavoritesAndMessageReadsAreSharedAcrossScreens() {
        val repository = repository()
        assertEquals("daniel", repository.searchTutors(" BUSINESS ", false).single().tutorId)
        assertEquals(1, repository.searchTutors("", true).size)
        repository.toggleFavorite("daniel")
        assertEquals(2, repository.searchTutors("", true).size)
        repository.toggleFavorite("maya")
        assertEquals("daniel", repository.searchTutors("", true).single().tutorId)
        repository.markMessageRead("welcome")
        repository.markMessageRead("welcome")
        assertEquals(1, repository.snapshot().unreadMessages)
    }
}
