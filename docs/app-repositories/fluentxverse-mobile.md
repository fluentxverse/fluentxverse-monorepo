# FluentXVerse Mobile

The native student-client workstream for FluentXVerse. Kotlin Multiplatform shares student models and API logic between an Android Jetpack Compose app and an iOS SwiftUI app.

## Current Scope

- Live student sign-in, session restoration/refresh, profile, statistics, and booking reads through the dedicated mobile API when deployed and enabled.
- Android Keystore and iOS Keychain storage for mobile session credentials.
- An explicitly separate offline demo covering discovery, booking, cancellation, tickets, materials, inbox, and profile.
- Shared JVM tests and Android UI tests using synthetic data.

The offline demo is not a live payment/booking system. Native live booking, classroom calls, purchases, registration, and push notifications are not complete. This source export does not imply an App Store or Play Store release.

## Structure

- `fluentxverse-mobile/shared/`: common Kotlin models, mobile API client, storage contract, and tests.
- `fluentxverse-mobile/androidApp/`: Android screens, lifecycle, secure token storage, and resources.
- `fluentxverse-mobile/iosApp/`: SwiftUI screens, Keychain integration, and Xcode project.
- `fluentxverse-server/MOBILE_API.md`: exported API contract, not a bundled backend.

See [the detailed mobile guide](fluentxverse-mobile/README.md) for platform structure and integration milestones. References there to sibling web applications refer to the source monorepo, not directories promised in this export.

## Android Development

Use JDK 17, Android Studio, and Android SDK platform 36. Configure `ANDROID_HOME` or an ignored `local.properties` file. From the repository root:

```bash
cd fluentxverse-mobile
./gradlew :androidApp:assembleDebug
./gradlew :shared:jvmTest :androidApp:testDebugUnitTest :androidApp:lintDebug
```

Android requires API 26+. The API server is separately deployed. An Android emulator reaches a host development API through `http://10.0.2.2:8765` where allowed by debug configuration. Release builds require HTTPS.

## iOS Development

On macOS with Xcode 16+ and JDK 17, open `fluentxverse-mobile/iosApp/FluentXverseStudent.xcodeproj`. Select the `FluentXverseStudent` scheme and an iOS 17+ simulator. Configure your own signing team for physical devices. Linux cannot validate an iOS build or Apple signing.

## Authentication and Privacy

Mobile bearer authentication is distinct from browser cookies and depends on the server's mobile module, its own signing secret, and configured session storage. Do not embed server credentials or wallet keys in the app. Native social-provider integration is a future milestone, not automatically supplied by the web app's Privy configuration. Verify secure storage, device logout, offline recovery, and server revocation on physical devices before release.
