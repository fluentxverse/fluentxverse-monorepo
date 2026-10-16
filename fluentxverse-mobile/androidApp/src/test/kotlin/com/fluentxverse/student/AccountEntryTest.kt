package com.fluentxverse.student

import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import java.io.File
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w393dp-h851dp")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AccountEntryTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun signInIsTheFirstScreenAndDemoCanBeExited() {
        compose.onNodeWithText("Sign in", substring = false).assertIsNotEnabled()
        compose.onNodeWithText("Email").assertIsDisplayed()
        compose.onNodeWithText("Password").assertIsDisplayed()
        compose.onNodeWithText("Open demo account").performClick()
        compose.onNodeWithText("Welcome back, Alex").assertIsDisplayed()
        compose.onNodeWithContentDescription("Leave demo").performClick()
        compose.onNodeWithText("Sign in to your student account").assertIsDisplayed()
    }

    @Test fun serverSettingsRejectInsecureRemoteAddresses() {
        compose.onNodeWithContentDescription("Server settings").performClick()
        compose.onNodeWithText("Server address").performTextReplacement("http://api.example.test")
        compose.onNodeWithText("Apply").performClick()
        compose.onNodeWithText("Use an HTTPS server address without a path, query, or credentials.").assertExists()
        compose.onNodeWithContentDescription("Back", substring = false).performClick()
    }

    @Test fun signInLayoutRenders() {
        compose.onNodeWithText("FluentXverse").assertIsDisplayed()
        compose.runOnIdle {
            val view = compose.activity.window.decorView
            val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
            view.draw(Canvas(bitmap))
            val file = File("build/screenshots/sign-in.png")
            file.parentFile?.mkdirs()
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
}
