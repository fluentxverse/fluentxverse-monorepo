package com.fluentxverse.student.api

import kotlinx.serialization.Serializable

@Serializable
data class StudentIdentity(
    val userId: String,
    val role: String,
    val givenName: String? = null,
    val familyName: String? = null,
    val email: String? = null,
)

@Serializable
data class AccountProfile(
    val id: String,
    val givenName: String? = null,
    val familyName: String? = null,
    val email: String? = null,
    val currentProficiency: String? = null,
    val timezone: String? = null,
)

@Serializable
data class AccountStats(val lessonsCompleted: Int, val upcomingLessons: Int, val totalHours: Double)

@Serializable
data class AccountBooking(
    val bookingId: String,
    val tutorId: String,
    val tutorName: String,
    val slotDate: String,
    val slotTime: String,
    val durationMinutes: Int,
    val status: String,
)

enum class AccountSection { PROFILE, STATISTICS, BOOKINGS }
data class AccountIssue(val section: AccountSection, val message: String)
data class StudentSignOutResult(val serverConfirmed: Boolean)
data class StudentAccount(
    val student: StudentIdentity,
    val profile: AccountProfile?,
    val statistics: AccountStats?,
    val bookings: List<AccountBooking>?,
    val issues: List<AccountIssue>,
)

enum class ApiFailure { CONFIGURATION, CREDENTIALS, SESSION_EXPIRED, FORBIDDEN, NETWORK, SERVER, RESPONSE, STORAGE }
class StudentApiException(val failure: ApiFailure, message: String) : Exception(message)
