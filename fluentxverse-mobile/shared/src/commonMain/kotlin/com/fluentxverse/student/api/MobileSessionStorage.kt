package com.fluentxverse.student.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

@Serializable
data class MobileTokenPair(val accessToken: String, val refreshToken: String)

@Serializable
data class StoredStudentSession(val server: String, val tokens: MobileTokenPair, val student: StudentIdentity) {
    fun encodeForStorage(): String = studentJson.encodeToString(this)

    companion object {
        fun decodeFromStorage(value: String): StoredStudentSession? =
            runCatching { studentJson.decodeFromString<StoredStudentSession>(value) }.getOrNull()
    }
}

/** Implemented with Android Keystore encryption or iOS Keychain, never plain preferences. */
interface MobileSessionStorage {
    fun load(): StoredStudentSession?
    fun save(session: StoredStudentSession): Boolean
    fun clear(): Boolean
}
