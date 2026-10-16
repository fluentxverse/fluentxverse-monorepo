package com.fluentxverse.student

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val colors = if (isSystemInDarkTheme()) darkColorScheme(
                primary = Color(0xFF9DC1FF), secondary = Color(0xFF85D5BC),
                tertiary = Color(0xFFF4C778), background = Color(0xFF191B20),
                surface = Color(0xFF21242A),
                surfaceContainer = Color(0xFF282B30), secondaryContainer = Color(0xFF244C3F),
            ) else lightColorScheme(
                primary = Color(0xFF0649B6), secondary = Color(0xFF127350),
                tertiary = Color(0xFF8D5C12), background = Color(0xFFF4F7FA),
                surface = Color.White, onSurface = Color(0xFF202B3D),
                surfaceContainer = Color.White, secondaryContainer = Color(0xFFE4F5EB),
            )
            val base = Typography()
            val typography = base.copy(
                displayLarge = base.displayLarge.copy(letterSpacing = 0.sp),
                displayMedium = base.displayMedium.copy(letterSpacing = 0.sp),
                displaySmall = base.displaySmall.copy(letterSpacing = 0.sp),
                headlineLarge = base.headlineLarge.copy(letterSpacing = 0.sp),
                headlineMedium = base.headlineMedium.copy(letterSpacing = 0.sp),
                headlineSmall = base.headlineSmall.copy(letterSpacing = 0.sp),
                titleLarge = base.titleLarge.copy(letterSpacing = 0.sp),
                titleMedium = base.titleMedium.copy(letterSpacing = 0.sp),
                titleSmall = base.titleSmall.copy(letterSpacing = 0.sp),
                bodyLarge = base.bodyLarge.copy(letterSpacing = 0.sp),
                bodyMedium = base.bodyMedium.copy(letterSpacing = 0.sp),
                bodySmall = base.bodySmall.copy(letterSpacing = 0.sp),
                labelLarge = base.labelLarge.copy(letterSpacing = 0.sp),
                labelMedium = base.labelMedium.copy(letterSpacing = 0.sp),
                labelSmall = base.labelSmall.copy(letterSpacing = 0.sp),
            )
            MaterialTheme(colorScheme = colors, typography = typography) { AccountEntry() }
        }
    }
}
