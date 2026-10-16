# FluentXverse Student Mobile

Kotlin Multiplatform student app with dedicated mobile bearer authentication. Android
uses Jetpack Compose; iOS uses SwiftUI. Both consume the same Kotlin models and
student repository. The current web reference is
`../fluentxverse-student-solid-prototype/student`, with older Preact code in
`../archive/preact/fluentxverse-student`.

## Current Scope

The app opens at student sign-in. The live account view loads the authenticated
student's profile, lesson statistics, and bookings from the new mobile API.
Session restoration, automatic token refresh, logout, retries, and independent
section failures are supported. The server address is configurable in Settings.

Select **Open demo account** for the original offline student experience:

- Home with lesson statistics, next lesson, and learning materials.
- Tutor search, favorites, profiles, and available lesson times.
- Demo booking with material selection and matching ticket consumption.
- Upcoming lessons, history, details, and demo cancellation with ticket return.
- Conversational Skills, Business English, and Daily Dispatch sample lessons.
- Ticket balances, inbox with read state, and profile.

The logo and material artwork come from the existing student web app. Lesson
text, tutors, messages, and balances are fixtures, not production data. The demo
repository makes no network requests. Its changes last for the app session;
Android keeps them across activity recreation using a ViewModel. Restarting the
process resets the account. Lesson times display in Asia/Manila (UTC+8).

Demo cancellation is intentionally simple and does not implement the real
student cancellation policy. Purchases, wallet actions, classroom calls,
notifications, live booking, and registration are not implemented yet. Live
account data is never filled with demo values when an API section fails.

## Mobile Authentication

The server implementation lives in `../fluentxverse-server`, under
`src/routes/mobileStudent.*` and `src/services/auth.services/mobile*`.
It reuses existing student accounts and password verification, issuing scoped
15-minute access JWTs and opaque rotating refresh tokens with a fixed 30-day
session expiry. Mobile endpoints authenticate bearer tokens and require neither
a browser Origin nor student cookies. Existing web authentication is unchanged.

Before starting the updated backend, configure a new `MOBILE_JWT_SECRET` with at
least 32 bytes of random data, different from `JWT_SECRET`. All backend replicas
must use the same mobile secret and PostgreSQL database. The module creates its
two session tables on first use, following existing server service patterns.
No production database or deployed server is modified by the tests.

See [the server API contract](../fluentxverse-server/MOBILE_API.md)
for endpoint payloads, setup, and session policy. The deployed API will not have
these endpoints until the server changes are deployed.

Tokens are encrypted with an Android Keystore AES-GCM key on Android and stored
in iOS Keychain with `WhenUnlockedThisDeviceOnly` access on iOS. Passwords are
never saved. Restored sessions are verified with the server before showing live
account data. Concurrent protected reads share one refresh operation. Rejected
refresh credentials clear the local session; a network outage retains a saved
session for another attempt. Offline logout clears local credentials and reports
that server revocation could not be confirmed.

Release builds require HTTPS. Android debug builds allow local HTTP only for
`localhost`, `127.0.0.1`, and the emulator host alias `10.0.2.2`. For an Android
emulator, set the server to `http://10.0.2.2:8765` when the updated backend runs on
the host's default port; for the iOS simulator,
use a reachable HTTPS address. No TLS certificate validation is disabled.

## Project Structure

| Location | Responsibility |
| --- | --- |
| `shared/src/commonMain` | Student models, repository contract, shared demo behavior |
| `shared/src/commonMain/.../api` | Mobile JWT client, token refresh, account contracts, storage interface |
| `shared/src/commonTest` | Booking, ticket, cancellation, favorites, and read-state checks |
| `androidApp/src/main` | Compose screens, Android lifecycle state, and app resources |
| `androidApp/src/test` | Android UI workflow tests and screen captures using Robolectric |
| `iosApp/FluentXverseStudent` | SwiftUI screens and a model backed by the shared repository |
| `iosApp/FluentXverseStudent.xcodeproj` | Xcode app and shared framework build phase |
| `gradle/libs.versions.toml` | Dependency and plugin versions |

## Android

Use JDK 17, Android SDK platform 36, and Android Studio with Kotlin support.
Open this directory as a Gradle project, sync, and run `androidApp` on a device
or emulator running Android 8.0 / API 26 or later.

Set the SDK path in the ignored `local.properties` file, or set `ANDROID_HOME`.
The initial build needs internet access for Gradle and Maven dependencies.

```bash
./gradlew :androidApp:assembleDebug
./gradlew :shared:jvmTest :androidApp:testDebugUnitTest :androidApp:lintDebug
```

The APK is `androidApp/build/outputs/apk/debug/androidApp-debug.apk`. With a
device connected:

```bash
adb install -r androidApp/build/outputs/apk/debug/androidApp-debug.apk
adb shell am start -n com.fluentxverse.student/.MainActivity
```

The Android UI tests run on the JVM with Robolectric; no emulator is required.
They exercise booking/cancellation across screens, search/favorites, material
navigation, and rendering. Captures are written to
`androidApp/build/screenshots/`. They do not replace testing on physical devices.

## iOS

On a Mac, install JDK 17 and Xcode 16 or later. Open
`iosApp/FluentXverseStudent.xcodeproj`, select the `FluentXverseStudent` scheme,
and run on an iOS 17+ simulator. For a physical device, configure your signing
team in Xcode. The shared framework is built automatically before Swift sources
using `:shared:embedAndSignAppleFrameworkForXcode`.

The framework is static and exports as `FluentXverseShared`. Apple Silicon
simulators, Intel simulators, and iOS devices are declared in the shared module.
iOS framework compilation and SwiftUI type checking require macOS; Linux can
check Swift syntax and project structure but cannot validate an iOS build.

The setup follows Kotlin's [direct Xcode integration](https://kotlinlang.org/docs/multiplatform/multiplatform-direct-integration.html).
Android uses the Kotlin [Compose compiler plugin](https://developer.android.com/develop/ui/compose/compiler).

## Next Integration Milestones

1. Deploy and configure the dedicated mobile API, then verify sign-in,
   restoration, refresh, logout, and device secure storage with test accounts.
   Add mobile registration and native identity-provider support.
2. Extend the live experience with tutor browsing, inbox, and curriculum content,
   using authenticated mobile routes and the existing domain services.
3. Connect the real reservation/booking flow and cancellation policy. Preserve
   server validation, reservation expiry, and ticket/private-pass recovery;
   do not reuse the demo ticket arithmetic for real payments.
4. Add classroom signaling, native audio/video, permissions, device checks,
   lesson feedback, and push reminders, then complete device integration tests.

Existing API references for the integration:

| Feature | Existing Web Contract |
| --- | --- |
| Session/profile | `student/api/auth.api.ts`, `student/api/student.api.ts` |
| Tutors/favorites | `student/api/tutor.api.ts`, `student/api/favorites.api.ts` |
| Statistics/schedule/booking | `student/api/schedule.api.ts` |
| Tickets/private passes | `student/api/ticket.api.ts`, `student/api/lessonPasses.api.ts` |
| Inbox | `student/api/inbox.api.ts` |
| Classroom/lesson | `student/pages/ClassroomPage.tsx`, `student/api/lesson.api.ts` |

Paths in this table are relative to `../fluentxverse-student-solid-prototype`.
The JVM target in `shared` supports fast common-code tests on Linux; it is not a
third student app UI.
