package com.fluentxverse.student.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.client.statement.HttpResponse
import io.ktor.http.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

class StudentApi internal constructor(
    private val config: StudentApiConfig,
    private val client: HttpClient,
    private val storage: MobileSessionStorage,
) {
    @Throws(StudentApiException::class)
    constructor(apiUrl: String, allowLocalHttp: Boolean, storage: MobileSessionStorage) : this(
        StudentApiConfig(apiUrl, allowLocalHttp), studentHttpClient(), storage
    )

    private var session: StoredStudentSession? = null
    private var closed = false
    private val refreshMutex = Mutex()

    @Throws(StudentApiException::class)
    suspend fun restoreSession(): StudentIdentity? {
        val stored = storage.load() ?: return null
        if (stored.server != config.baseUrl) return null
        validateStudent(stored.student)
        session = stored
        return verifySession(stored.student.userId)
    }

    @Throws(StudentApiException::class)
    suspend fun signIn(email: String, password: String): StudentIdentity {
        if (email.isBlank() || password.isEmpty()) {
            throw StudentApiException(ApiFailure.CREDENTIALS, "Enter your email and password.")
        }
        clearLocalSession()
        val reply = request<TokenReply>("/auth/login", HttpMethod.Post,
            studentJson.encodeToString(SignInPayload(email.trim(), password)), authenticated = false)
        validateTokens(reply)
        session = StoredStudentSession(config.baseUrl, MobileTokenPair(reply.accessToken, reply.refreshToken), reply.user)
        try {
            val user = verifySession(reply.user.userId)
            persist(session!!.copy(student = user))
            return user
        } catch (error: Exception) {
            clearLocalSession()
            throw error
        }
    }

    @Throws(StudentApiException::class)
    suspend fun verifySession(expectedUserId: String): StudentIdentity {
        val user = request<IdentityReply>("/me").user
        validateStudent(user)
        if (user.userId != expectedUserId) {
            clearLocalSession()
            throw StudentApiException(ApiFailure.SESSION_EXPIRED, "Your account changed. Please sign in again.")
        }
        return user
    }

    @Throws(StudentApiException::class)
    suspend fun loadAccount(expectedUserId: String): StudentAccount = coroutineScope {
        val student = verifySession(expectedUserId)
        val profile = async { section(AccountSection.PROFILE) {
            val value = request<DataReply<AccountProfile>>("/profile").requiredData()
            if (value.id != expectedUserId) {
                clearLocalSession()
                throw StudentApiException(ApiFailure.SESSION_EXPIRED, "Your account changed. Please sign in again.")
            }
            value
        } }
        val stats = async { section(AccountSection.STATISTICS) { request<DataReply<AccountStats>>("/stats").requiredData() } }
        val bookings = async { section(AccountSection.BOOKINGS) { request<DataReply<List<AccountBooking>>>("/bookings").requiredData() } }
        val p = profile.await()
        val s = stats.await()
        val b = bookings.await()
        StudentAccount(student, p.first, s.first, b.first, listOfNotNull(p.second, s.second, b.second))
    }

    @Throws(StudentApiException::class)
    suspend fun signOut(): StudentSignOutResult {
        val current = session
        return try {
            StudentSignOutResult(current == null || request<StatusReply>("/auth/logout", HttpMethod.Post,
                studentJson.encodeToString(RefreshPayload(current.tokens.refreshToken)), authenticated = false).success)
        } catch (error: CancellationException) {
            throw error
        } catch (_: StudentApiException) {
            StudentSignOutResult(false)
        } finally {
            try { clearLocalSession() } finally { close() }
        }
    }

    fun close() { closed = true; session = null; client.close() }

    private fun clearLocalSession() {
        session = null
        if (!storage.clear()) throw StudentApiException(ApiFailure.STORAGE, "Unable to clear the saved session on this device.")
    }

    private fun persist(value: StoredStudentSession) {
        checkOpen()
        if (!storage.save(value)) {
            clearLocalSession()
            throw StudentApiException(ApiFailure.STORAGE, "Unable to save your session securely on this device.")
        }
        session = value
    }

    private fun validateStudent(user: StudentIdentity) {
        if (user.userId.isBlank() || user.role != "student") {
            clearLocalSession()
            throw StudentApiException(ApiFailure.SESSION_EXPIRED, "A student account is required. Please sign in again.")
        }
    }

    private fun validateTokens(reply: TokenReply) {
        validateStudent(reply.user)
        if (!reply.success || reply.tokenType != "Bearer" || reply.accessToken.isBlank() || reply.refreshToken.isBlank()) {
            clearLocalSession()
            throw StudentApiException(ApiFailure.RESPONSE, "The server returned an unexpected sign-in response.")
        }
    }

    private suspend fun refresh(observedToken: String?) = refreshMutex.withLock {
        checkOpen()
        val current = session ?: throw StudentApiException(ApiFailure.SESSION_EXPIRED, "Please sign in again.")
        if (current.tokens.accessToken != observedToken) return@withLock
        val reply = request<TokenReply>("/auth/refresh", HttpMethod.Post,
            studentJson.encodeToString(RefreshPayload(current.tokens.refreshToken)), authenticated = false)
        validateTokens(reply)
        if (reply.user.userId != current.student.userId) {
            clearLocalSession()
            throw StudentApiException(ApiFailure.SESSION_EXPIRED, "Your account changed. Please sign in again.")
        }
        persist(StoredStudentSession(config.baseUrl, MobileTokenPair(reply.accessToken, reply.refreshToken), reply.user))
    }

    private suspend fun <T> section(section: AccountSection, load: suspend () -> T): Pair<T?, AccountIssue?> =
        try { load() to null } catch (error: StudentApiException) {
            if (error.failure == ApiFailure.SESSION_EXPIRED || error.failure == ApiFailure.STORAGE) throw error
            null to AccountIssue(section, error.message ?: "Unable to load this section.")
        }

    private fun checkOpen() {
        if (closed) throw StudentApiException(ApiFailure.SESSION_EXPIRED, "Please sign in again.")
    }

    private suspend fun send(path: String, method: HttpMethod, body: String?, accessToken: String?): HttpResponse = try {
        checkOpen()
        client.request(config.baseUrl + "/mobile/student" + path) {
            this.method = method
            accept(ContentType.Application.Json)
            header(HttpHeaders.CacheControl, "no-store")
            accessToken?.let { bearerAuth(it) }
            if (body != null) { contentType(ContentType.Application.Json); setBody(body) }
        }.also { checkOpen() }
    } catch (error: CancellationException) {
        throw error
    } catch (error: StudentApiException) {
        throw error
    } catch (_: Exception) {
        throw StudentApiException(ApiFailure.NETWORK, "Unable to reach the server. Check your connection and try again.")
    }

    private suspend inline fun <reified T> request(
        path: String, method: HttpMethod = HttpMethod.Get, body: String? = null, authenticated: Boolean = true,
    ): T {
        val observedToken = if (authenticated) session?.tokens?.accessToken else null
        if (authenticated && observedToken == null) throw StudentApiException(ApiFailure.SESSION_EXPIRED, "Please sign in again.")
        var response = send(path, method, body, observedToken)
        if (response.status == HttpStatusCode.Unauthorized && authenticated) {
            refresh(observedToken)
            response = send(path, method, body, session?.tokens?.accessToken)
        }
        if (response.status.value !in 200..299) {
            val failure = when (response.status.value) {
                401 -> if (path == "/auth/login") ApiFailure.CREDENTIALS else ApiFailure.SESSION_EXPIRED
                403 -> if (path == "/me" || path == "/auth/refresh") ApiFailure.SESSION_EXPIRED else ApiFailure.FORBIDDEN
                in 500..599 -> ApiFailure.SERVER
                else -> ApiFailure.RESPONSE
            }
            if (failure == ApiFailure.SESSION_EXPIRED) clearLocalSession()
            val message = when {
                failure == ApiFailure.SESSION_EXPIRED -> "Your session has expired. Please sign in again."
                failure == ApiFailure.CREDENTIALS -> "Check your email and password and try again."
                failure == ApiFailure.FORBIDDEN -> "This student account cannot access the requested information."
                response.status.value == 429 -> "Too many attempts. Please try again later."
                else -> "The server could not complete this request. Please try again."
            }
            throw StudentApiException(failure, message)
        }
        return try { response.body<T>() } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            throw StudentApiException(ApiFailure.RESPONSE, "The server returned an unexpected response.")
        }
    }
}

@Serializable private data class SignInPayload(val email: String, val password: String)
@Serializable private data class RefreshPayload(val refreshToken: String)
@Serializable private data class IdentityReply(val user: StudentIdentity)
@Serializable private data class TokenReply(
    val success: Boolean, val tokenType: String, val accessToken: String, val refreshToken: String,
    val user: StudentIdentity,
)
@Serializable private data class StatusReply(val success: Boolean)
@Serializable private data class DataReply<T>(val success: Boolean, val data: T? = null) {
    fun requiredData(): T = if (success && data != null) data else {
        throw StudentApiException(ApiFailure.RESPONSE, "Unable to load this section. Please try again.")
    }
}
