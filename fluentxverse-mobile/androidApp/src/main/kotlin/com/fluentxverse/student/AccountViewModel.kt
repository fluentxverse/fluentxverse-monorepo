package com.fluentxverse.student

import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.fluentxverse.student.api.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class AccountMode { SIGN_IN, DEMO, ACCOUNT }
data class AccountUiState(
    val mode: AccountMode = AccountMode.SIGN_IN,
    val server: String = "https://api.fluentxverse.com",
    val busy: Boolean = false,
    val student: StudentIdentity? = null,
    val account: StudentAccount? = null,
    val error: String? = null,
)

class AccountViewModel(application: Application) : AndroidViewModel(application) {
    private val preferences = application.getSharedPreferences("mobile_connection", Context.MODE_PRIVATE)
    private val storage = MobileTokenStore(application)
    private val mutableState = MutableStateFlow(AccountUiState(server = preferences.getString("server", null) ?: "https://api.fluentxverse.com"))
    val state = mutableState.asStateFlow()
    private var api: StudentApi? = null
    private var request: Job? = null

    init {
        if (storage.load() != null) execute {
            val connection = connection()
            val student = connection.restoreSession()
            if (student != null) {
                mutableState.value = mutableState.value.copy(mode = AccountMode.ACCOUNT, student = student)
                mutableState.value = mutableState.value.copy(account = connection.loadAccount(student.userId))
            }
        }
    }

    fun signIn(email: String, password: String) = execute {
        val connection = connection()
        val student = connection.signIn(email, password)
        mutableState.value = mutableState.value.copy(mode = AccountMode.ACCOUNT, student = student)
        mutableState.value = mutableState.value.copy(account = connection.loadAccount(student.userId))
    }

    fun refresh() = execute {
        val student = mutableState.value.student ?: return@execute
        mutableState.value = mutableState.value.copy(account = connection().loadAccount(student.userId))
    }

    fun signOut() = execute {
        val confirmed = api?.signOut()?.serverConfirmed ?: storage.clear()
        api = null
        mutableState.value = AccountUiState(server = mutableState.value.server,
            error = if (confirmed) null else "Signed out on this device. Server sign-out could not be confirmed.")
    }

    fun enterDemo() { request?.cancel(); api?.close(); api = null; mutableState.value = mutableState.value.copy(mode = AccountMode.DEMO, busy = false, error = null) }
    fun leaveDemo() { mutableState.value = AccountUiState(server = mutableState.value.server) }

    @SuppressLint("UseKtx")
    fun setServer(value: String): Boolean {
        return try {
            val config = StudentApiConfig(value, BuildConfig.DEBUG)
            request?.cancel()
            api?.close(); api = null
            if (!storage.clear() || !preferences.edit().putString("server", config.baseUrl).commit()) {
                throw StudentApiException(ApiFailure.STORAGE, "Unable to save the server address on this device.")
            }
            mutableState.value = AccountUiState(server = config.baseUrl)
            true
        } catch (error: StudentApiException) {
            mutableState.value = mutableState.value.copy(error = error.message)
            false
        }
    }

    private fun connection(): StudentApi = api ?: StudentApi(mutableState.value.server, BuildConfig.DEBUG, storage).also { api = it }

    private fun execute(action: suspend () -> Unit) {
        if (mutableState.value.busy) return
        mutableState.value = mutableState.value.copy(busy = true, error = null)
        request = viewModelScope.launch {
            try { action() } catch (error: CancellationException) {
                throw error
            } catch (error: StudentApiException) {
                if (error.failure == ApiFailure.SESSION_EXPIRED || error.failure == ApiFailure.STORAGE) {
                    api?.close(); api = null
                    mutableState.value = AccountUiState(server = mutableState.value.server, error = error.message)
                } else mutableState.value = mutableState.value.copy(error = error.message)
            } finally { mutableState.value = mutableState.value.copy(busy = false) }
        }
    }

    override fun onCleared() { api?.close() }
}
