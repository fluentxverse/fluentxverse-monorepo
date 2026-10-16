package com.fluentxverse.student.api

import io.ktor.http.URLProtocol
import io.ktor.http.Url

class StudentApiConfig @Throws(StudentApiException::class) constructor(apiUrl: String, allowLocalHttp: Boolean) {
    val baseUrl: String

    init {
        val url = try { Url(apiUrl.trim()) } catch (_: Exception) {
            throw StudentApiException(ApiFailure.CONFIGURATION, "Enter a valid server address.")
        }
        val local = url.host in listOf("localhost", "127.0.0.1", "10.0.2.2")
        if (url.host.isBlank() || (url.protocol != URLProtocol.HTTPS &&
                !(allowLocalHttp && local && url.protocol == URLProtocol.HTTP)) ||
            url.user != null || url.password != null || url.parameters.entries().isNotEmpty() ||
            url.fragment.isNotEmpty() || url.encodedPath !in listOf("", "/")) {
            throw StudentApiException(ApiFailure.CONFIGURATION,
                "Use an HTTPS server address without a path, query, or credentials.")
        }
        baseUrl = url.toString().trimEnd('/')
    }
}
