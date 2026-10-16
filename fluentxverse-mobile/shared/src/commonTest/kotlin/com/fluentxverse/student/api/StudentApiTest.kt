package com.fluentxverse.student.api

import io.ktor.client.engine.mock.*
import io.ktor.http.*
import io.ktor.http.content.TextContent
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import kotlin.test.*

class StudentApiTest {
    private val origin = "https://api.example.test"
    private val user = """{"userId":"student-1","role":"student","givenName":"Alex","email":"alex@example.test"}"""
    private fun tokens(access: String = "access-1", refresh: String = "refresh-1") =
        """{"success":true,"tokenType":"Bearer","accessToken":"$access","refreshToken":"$refresh","user":$user}"""

    private class MemoryStorage : MobileSessionStorage {
        var value: StoredStudentSession? = null
        var saving = true
        override fun load() = value
        override fun save(session: StoredStudentSession): Boolean { if (saving) value = session; return saving }
        override fun clear(): Boolean { value = null; return true }
    }

    private fun api(storage: MemoryStorage, handler: MockRequestHandler): StudentApi =
        StudentApi(StudentApiConfig(origin, false), studentHttpClient(MockEngine(handler)), storage)

    @Test fun signInUsesMobileRoutesBearerHeadersAndVerifiedIdentity() = runTest {
        val storage = MemoryStorage()
        val paths = mutableListOf<String>()
        val api = api(storage) { request ->
            paths += request.url.encodedPath
            assertNull(request.headers[HttpHeaders.Cookie])
            assertNull(request.headers[HttpHeaders.Origin])
            when (request.url.encodedPath) {
                "/mobile/student/auth/login" -> {
                    val payload = Json.parseToJsonElement((request.body as TextContent).text).jsonObject
                    assertEquals("alex@example.test", payload["email"]?.jsonPrimitive?.content)
                    assertEquals(" password with spaces ", payload["password"]?.jsonPrimitive?.content)
                    assertNull(request.headers[HttpHeaders.Authorization])
                    respond(tokens(), headers = jsonHeaders())
                }
                else -> {
                    assertEquals("Bearer access-1", request.headers[HttpHeaders.Authorization])
                    respond("""{"user":$user}""", headers = jsonHeaders())
                }
            }
        }
        assertEquals("student-1", api.signIn(" alex@example.test ", " password with spaces ").userId)
        assertEquals(listOf("/mobile/student/auth/login", "/mobile/student/me"), paths)
        assertEquals(origin, storage.value?.server)
        api.close()
    }

    @Test fun savedSessionsRestoreWithRefreshWithoutSendingAPassword() = runTest {
        val storage = MemoryStorage().apply {
            value = StoredStudentSession(origin, MobileTokenPair("expired", "refresh-old"), StudentIdentity("student-1", "student"))
        }
        var refreshes = 0
        val api = api(storage) { request ->
            when (request.url.encodedPath) {
                "/mobile/student/auth/refresh" -> {
                    refreshes++
                    val body = Json.parseToJsonElement((request.body as TextContent).text).jsonObject
                    assertEquals("refresh-old", body["refreshToken"]?.jsonPrimitive?.content)
                    assertFalse("password" in body)
                    respond(tokens("access-new", "refresh-new"), headers = jsonHeaders())
                }
                "/mobile/student/me" -> if (request.headers[HttpHeaders.Authorization] == "Bearer expired") {
                    respond("{}", HttpStatusCode.Unauthorized, jsonHeaders())
                } else respond("""{"user":$user}""", headers = jsonHeaders())
                else -> error("Unexpected request")
            }
        }
        assertEquals("student-1", api.restoreSession()?.userId)
        assertEquals(1, refreshes)
        assertEquals("refresh-new", storage.value?.tokens?.refreshToken)
        api.close()
    }

    @Test fun parallelAccountReadsShareOneRefreshRotation() = runTest {
        val storage = MemoryStorage()
        var refreshes = 0
        var expired = false
        val api = api(storage) { request ->
            val path = request.url.encodedPath
            when {
                path.endsWith("/auth/login") -> respond(tokens(), headers = jsonHeaders())
                path.endsWith("/auth/refresh") -> {
                    refreshes++; delay(10)
                    respond(tokens("access-new", "refresh-new"), headers = jsonHeaders())
                }
                path.endsWith("/me") -> respond("""{"user":$user}""", headers = jsonHeaders())
                expired && request.headers[HttpHeaders.Authorization] == "Bearer access-1" ->
                    respond("{}", HttpStatusCode.Unauthorized, jsonHeaders())
                path.endsWith("/profile") -> respond("""{"success":true,"data":{"id":"student-1","givenName":"Alex"}}""", headers = jsonHeaders())
                path.endsWith("/stats") -> respond("""{"success":true,"data":{"lessonsCompleted":2,"upcomingLessons":0,"totalHours":0.8}}""", headers = jsonHeaders())
                path.endsWith("/bookings") -> respond("""{"success":true,"data":[]}""", headers = jsonHeaders())
                else -> error("Unexpected request")
            }
        }
        api.signIn("alex@example.test", "password")
        expired = true
        val account = api.loadAccount("student-1")
        assertEquals(1, refreshes)
        assertEquals(2, account.statistics?.lessonsCompleted)
        assertTrue(account.issues.isEmpty())
        api.close()
    }

    @Test fun rejectedRefreshClearsTheSavedSession() = runTest {
        val storage = MemoryStorage().apply {
            value = StoredStudentSession(origin, MobileTokenPair("expired", "revoked"), StudentIdentity("student-1", "student"))
        }
        val api = api(storage) { respond("{}", HttpStatusCode.Unauthorized, jsonHeaders()) }
        val error = assertFailsWith<StudentApiException> { api.restoreSession() }
        assertEquals(ApiFailure.SESSION_EXPIRED, error.failure)
        assertNull(storage.value)
        api.close()
    }

    @Test fun accountIdentityMismatchCannotRestoreOrShowAnotherProfile() = runTest {
        val storage = MemoryStorage()
        val api = api(storage) { request ->
            if (request.url.encodedPath.endsWith("/auth/login")) respond(tokens(), headers = jsonHeaders())
            else respond("""{"user":{"userId":"other-student","role":"student"}}""", headers = jsonHeaders())
        }
        assertFailsWith<StudentApiException> { api.signIn("alex@example.test", "password") }
        assertNull(storage.value)
        api.close()
    }

    @Test fun oneUnavailableSectionDoesNotReplaceRealDataWithDemoValues() = runTest {
        val storage = MemoryStorage()
        val api = api(storage) { request ->
            when {
                request.url.encodedPath.endsWith("/auth/login") -> respond(tokens(), headers = jsonHeaders())
                request.url.encodedPath.endsWith("/me") -> respond("""{"user":$user}""", headers = jsonHeaders())
                request.url.encodedPath.endsWith("/profile") -> respond("{}", HttpStatusCode.ServiceUnavailable, jsonHeaders())
                request.url.encodedPath.endsWith("/stats") -> respond("""{"success":true,"data":{"lessonsCompleted":0,"upcomingLessons":0,"totalHours":0.0}}""", headers = jsonHeaders())
                else -> respond("""{"success":true,"data":[]}""", headers = jsonHeaders())
            }
        }
        api.signIn("alex@example.test", "password")
        val account = api.loadAccount("student-1")
        assertNull(account.profile)
        assertEquals(0, account.statistics?.lessonsCompleted)
        assertEquals(AccountSection.PROFILE, account.issues.single().section)
        assertTrue(account.bookings!!.isEmpty())
        api.close()
    }

    @Test fun localLogoutClearsTokensEvenWhenOffline() = runTest {
        val storage = MemoryStorage()
        val api = api(storage) { request ->
            when {
                request.url.encodedPath.endsWith("/auth/login") -> respond(tokens(), headers = jsonHeaders())
                request.url.encodedPath.endsWith("/me") -> respond("""{"user":$user}""", headers = jsonHeaders())
                else -> throw IllegalStateException("Offline")
            }
        }
        api.signIn("alex@example.test", "password")
        assertFalse(api.signOut().serverConfirmed)
        assertNull(storage.value)
        assertFailsWith<StudentApiException> { api.verifySession("student-1") }
    }

    @Test fun sessionStorageFailureCannotLeaveAnAuthenticatedClient() = runTest {
        val storage = MemoryStorage().apply { saving = false }
        val api = api(storage) { request ->
            respond(if (request.url.encodedPath.endsWith("/auth/login")) tokens() else """{"user":$user}""", headers = jsonHeaders())
        }
        assertEquals(ApiFailure.STORAGE, assertFailsWith<StudentApiException> { api.signIn("alex@example.test", "password") }.failure)
        assertNull(storage.value)
        assertFailsWith<StudentApiException> { api.verifySession("student-1") }
        api.close()
    }

    @Test fun serverConfigurationRejectsUnsafeOrAmbiguousAddresses() {
        listOf("http://api.example.test", "https://user:password@api.example.test", "https://api.example.test/path", "https://api.example.test?token=secret", "ftp://api.example.test")
            .forEach { assertFailsWith<StudentApiException> { StudentApiConfig(it, false) } }
        assertEquals("http://10.0.2.2:3000", StudentApiConfig("http://10.0.2.2:3000/", true).baseUrl)
    }

    private fun jsonHeaders() = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString())
}
