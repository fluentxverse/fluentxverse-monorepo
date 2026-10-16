package com.fluentxverse.student

import android.annotation.SuppressLint
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.fluentxverse.student.api.MobileSessionStorage
import com.fluentxverse.student.api.StoredStudentSession
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// Refresh rotation must confirm durable writes before replacing saved credentials.
@SuppressLint("ApplySharedPref", "UseKtx")
class MobileTokenStore(context: Context) : MobileSessionStorage {
    private val preferences = context.getSharedPreferences("mobile_session", Context.MODE_PRIVATE)
    private val alias = "fluentxverse.mobile.session"

    override fun load(): StoredStudentSession? {
        val value = preferences.getString("encrypted_session", null) ?: return null
        return try {
            val bytes = Base64.decode(value, Base64.NO_WRAP)
            require(bytes.size > 12)
            val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            val key = keyStore.getKey(alias, null) as SecretKey
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
            StoredStudentSession.decodeFromStorage(String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
                ?: throw IllegalStateException("Invalid session")
        } catch (_: Exception) { clear(); null }
    }

    override fun save(session: StoredStudentSession): Boolean = try {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val key = if (keyStore.containsAlias(alias)) keyStore.getKey(alias, null) as SecretKey else {
            KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
                init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256).build())
            }.generateKey()
        }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val encrypted = cipher.doFinal(session.encodeForStorage().toByteArray(Charsets.UTF_8))
        preferences.edit().putString("encrypted_session", Base64.encodeToString(cipher.iv + encrypted, Base64.NO_WRAP)).commit()
    } catch (_: Exception) { false }

    override fun clear(): Boolean = preferences.edit().remove("encrypted_session").commit()
}
