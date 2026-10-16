package com.fluentxverse.student

import androidx.lifecycle.ViewModel
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class StudentViewModel : ViewModel() {
    private val repository: StudentRepository = DemoStudentRepository(
        LocalDate.now(ZoneId.of("Asia/Manila")).atStartOfDay(ZoneId.of("Asia/Manila")).toInstant().toEpochMilli()
    )
    private val mutableSnapshot = MutableStateFlow(repository.snapshot())
    val snapshot = mutableSnapshot.asStateFlow()

    fun toggleFavorite(tutorId: String) {
        repository.toggleFavorite(tutorId)
        publish()
    }

    fun markRead(messageId: String) {
        repository.markMessageRead(messageId)
        publish()
    }

    fun availableSlots(tutorId: String): List<LessonSlot> =
        repository.availableSlots(tutorId, System.currentTimeMillis())

    fun book(slotId: String, materialId: String?): StudentActionResult =
        repository.bookLesson(slotId, materialId, System.currentTimeMillis()).also { publish() }

    fun cancel(bookingId: String): StudentActionResult =
        repository.cancelLesson(bookingId, System.currentTimeMillis()).also { publish() }

    private fun publish() { mutableSnapshot.value = repository.snapshot() }
}
