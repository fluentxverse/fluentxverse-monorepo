package com.fluentxverse.student.api

import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.engine.cio.CIO

internal actual fun platformEngine(): HttpClientEngine = CIO.create()
