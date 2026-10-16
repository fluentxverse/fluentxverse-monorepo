package com.fluentxverse.student

/** The first implementation is local. A remote implementation must use server-authorized bookings. */
interface StudentRepository {
    fun snapshot(): StudentSnapshot
    fun searchTutors(query: String, favoritesOnly: Boolean): List<Tutor>
    fun availableSlots(tutorId: String, nowEpochMillis: Long): List<LessonSlot>
    fun toggleFavorite(tutorId: String)
    fun markMessageRead(messageId: String)
    fun bookLesson(slotId: String, materialId: String?, nowEpochMillis: Long): StudentActionResult
    fun cancelLesson(bookingId: String, nowEpochMillis: Long): StudentActionResult
}
