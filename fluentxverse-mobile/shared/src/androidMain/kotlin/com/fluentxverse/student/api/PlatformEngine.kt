package com.fluentxverse.student.api

import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.engine.okhttp.OkHttp

internal actual fun platformEngine(): HttpClientEngine = OkHttp.create {
    config { followRedirects(false); followSslRedirects(false) }
}
