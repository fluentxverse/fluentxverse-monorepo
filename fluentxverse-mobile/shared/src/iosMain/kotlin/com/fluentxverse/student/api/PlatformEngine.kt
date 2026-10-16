package com.fluentxverse.student.api

import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.engine.darwin.Darwin

internal actual fun platformEngine(): HttpClientEngine = Darwin.create {
    configureSession {
        setHTTPCookieStorage(null)
        setHTTPShouldSetCookies(false)
        setURLCache(null)
    }
}
