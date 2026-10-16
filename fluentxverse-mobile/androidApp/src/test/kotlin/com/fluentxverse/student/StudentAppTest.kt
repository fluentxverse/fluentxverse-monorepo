package com.fluentxverse.student

import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import java.io.File
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import org.junit.Rule
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w393dp-h851dp")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class StudentAppTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Before fun enterDemo() {
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Open demo account"))
        compose.onNodeWithText("Open demo account").performClick()
    }

    @Test fun bookingAndCancellationUpdateScheduleAndTicketScreens() {
        compose.onNodeWithText("Tutors").performClick()
        compose.onNodeWithText("Daniel").performClick()
        val tomorrow = LocalDate.now(ZoneId.of("Asia/Manila")).plusDays(1).atTime(18, 0)
            .format(DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a"))
        compose.onNodeWithText(tomorrow).performClick()
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Book demo lesson"))
        compose.onNodeWithText("Book demo lesson").performClick()
        compose.onNodeWithText("Confirm booking").performClick()
        compose.activityRule.scenario.recreate()
        compose.onNodeWithText("Lesson with Daniel").assertExists()
        compose.onNodeWithText("Profile").performClick()
        compose.onNodeWithText("My tickets").performClick()
        compose.onNodeWithText("6 demo tickets available").assertExists()
        compose.onNodeWithText("Schedule").performClick()
        compose.onNodeWithText("Lesson with Daniel").performClick()
        compose.onNodeWithText("Cancel demo lesson").performClick()
        compose.onNodeWithText("Cancel lesson", substring = false).performClick()
        compose.onNodeWithText("Lesson with Daniel").assertDoesNotExist()
        compose.onNodeWithText("Profile").performClick()
        compose.onNodeWithText("My tickets").performClick()
        compose.onNodeWithText("7 demo tickets available").assertExists()
    }

    @Test fun searchFavoritesAndMaterialDetailsRemainNavigable() {
        compose.onNodeWithText("Tutors").performClick()
        compose.onNodeWithContentDescription("Favorite Daniel").performClick()
        compose.onNodeWithText("Favorites", substring = false).performClick()
        compose.onNodeWithText("Daniel").assertExists()
        compose.onNodeWithText("Search tutors").performTextInput("business")
        compose.onNodeWithText("Maya").assertDoesNotExist()
        compose.onNodeWithText("Daniel").assertExists()
        compose.onNodeWithText("Materials", substring = false).performClick()
        compose.onNodeWithText("Business English").performClick()
        compose.onNodeWithText("Vocabulary").performScrollTo().assertIsDisplayed()
        compose.onNodeWithContentDescription("Back", substring = false).performClick()
        compose.onNodeWithText("Learning materials").assertExists()
    }

    @Test fun homeAndMaterialArtworkRender() {
        compose.onNodeWithText("Welcome back, Alex").assertIsDisplayed()
        compose.onNodeWithText("Lesson with Maya").assertIsDisplayed()
        capture("home")
        compose.onNodeWithText("Materials", substring = false).performClick()
        compose.onNodeWithText("Conversational Skills").assertIsDisplayed()
        capture("materials")
    }

    @Test
    @Config(sdk = [34], qualifiers = "w851dp-h393dp-land")
    fun landscapeNavigationAndMaterialsRender() {
        compose.onNodeWithText("Welcome back, Alex").assertIsDisplayed()
        capture("home-landscape")
        compose.onNodeWithText("Materials", substring = false).performClick()
        compose.onNodeWithText("Business English").assertIsDisplayed()
        capture("materials-landscape")
    }

    @Test
    @Config(sdk = [34], qualifiers = "w800dp-h1280dp")
    fun tabletContentAndNavigationRender() {
        compose.onNodeWithText("Welcome back, Alex").assertIsDisplayed()
        compose.onNodeWithText("Lesson with Maya").assertIsDisplayed()
        capture("home-tablet")
    }

    private fun capture(name: String) {
        compose.runOnIdle {
            val view = compose.activity.window.decorView
            val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
            view.draw(Canvas(bitmap))
            val file = File("build/screenshots/$name.png")
            file.parentFile?.mkdirs()
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
}
