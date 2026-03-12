# Repository-specific Copilot instructions

This file helps AI coding agents (Copilot-style) become productive quickly in this Flutter webview app.

Purpose & Big Picture
- **What:** This is a Flutter mobile app that hosts a web application inside an in-app webview (`flutter_inappwebview`).
- **Why:** The app wraps a web URL (see `lib/main.dart` constant `MAIN_HOME_URL`) to provide a mobile shell with native download, permission and notification integrations.
- **Major components:**
  - `lib/main.dart`: single-entry Flutter app that contains the UI and InAppWebView logic (progress bars, pull-to-refresh, download handling).
  - `android/`, `ios/`: platform projects; platform-level configuration (package name, Firebase config, permissions) lives here.
  - `pubspec.yaml`: declares dependencies and app metadata (icons, packages used).

Developer workflows & useful commands
- Install dependencies: `flutter pub get`.
- Run on connected device / emulator: `flutter run` (or `flutter run -d <deviceId>`).
- Build release APK (Windows Powershell):
  - `flutter build apk --release`
- Build iOS (macOS only):
  - `flutter build ios --release`
- Static assets: `assets/icon/icon.png` is used for splash / app icon (see `flutter_icons` section in `pubspec.yaml`).

Project-specific conventions & patterns
- Single-file app: Most app logic lives in `lib/main.dart`. Expect edits here for UI/behavior changes rather than multiple feature modules.
- Web-first behavior: The web URL is configured via `MAIN_HOME_URL` and `MAIN_TITLE` in `lib/main.dart`. Changing the hosted app's behavior usually only requires updating that URL or the page's JS.
- Downloads & storage: Downloads are handled with `flutter_downloader` and saved to the app documents directory (`getApplicationDocumentsDirectory()`). The app requests several runtime permissions at startup (storage, photos, videos, manage external storage, notifications, camera) — see the permission requests at top of `main()`.
- URL handling: External scheme navigation is handled in `shouldOverrideUrlLoading` — non-http(s) schemes try to `url_launcher` before cancelling the webview navigation.
- Cookie management: `updateCookies` reads cookies via `CookieManager` (see `lib/main.dart`), used after `onLoadStop`.

Integration points & external dependencies
- Plugins used (see `pubspec.yaml`): `flutter_inappwebview`, `url_launcher`, `flutter_downloader`, `permission_handler`, `firebase_core`, `firebase_messaging`, `flutter_local_notifications`, `dio`, `path_provider`.
- Firebase: `firebase_core` and `firebase_messaging` appear in `pubspec.yaml`. Check `android/app` and `ios/Runner` for `google-services.json` / `GoogleService-Info.plist` if configuring FCM.
- Native config: Some platform changes may be required in `android/app/build.gradle` and `AndroidManifest.xml` (permissions for storage/downloads, notification setup). `main.dart` contains a comment pointing to `android/app/build.gradle` for package name changes.

What to change for common tasks (concrete examples)
- Change home URL: edit `MAIN_HOME_URL` in `lib/main.dart` and rebuild.
- Change app icon: update `assets/icon/icon.png` and run `flutter pub run flutter_launcher_icons:main` (config already present in `pubspec.yaml`).
- Enable downloads on Android 11+: validate `AndroidManifest.xml` permissions and that `Permission.manageExternalStorage` is handled; the app requests it at startup but platform manifest must allow required storage access.

Testing and CI notes
- There are no project-specific tests beyond the default `test/widget_test.dart`. Use `flutter test` to run tests.
- If adding CI, use `flutter pub get` then `flutter build` steps and ensure platform credentials (Google services files, signing keys) are provided as secrets.

Constraints & gotchas discovered in code
- The app requests multiple runtime permissions up-front (camera, storage, photos, videos, notifications). Changes to permission flow should respect the current in-code ordering (in `main()`), and verify behavior on both Android and iOS.
- `FlutterDownloader.initialize` is called with `ignoreSsl: true` — be cautious when changing this flag as it relaxes SSL certificate checks.
- `shouldOverrideUrlLoading` checks for non-standard schemes and calls `url_launcher` using the raw `url` value; ensure `canLaunch` and `launch` usage matches the `url_launcher` version in `pubspec.yaml`.

Where to look first when asked to implement features
- For webview behavior, navigation, downloads, or cookies: `lib/main.dart`.
- For platform-specific issues (permissions, Firebase, app id, signing): `android/app` and `ios/Runner`.
- For dependency changes: `pubspec.yaml`.

If you need more context
- Ask for the target platform (Android/iOS), whether Firebase credentials are available, and if the goal is UI-only (change URL/title) or deeper native integration (download paths, permissions, notifications).

Contact / follow-ups
- After edits to this file, ask maintainers where platform secrets live and whether CI handles release builds. When uncertain about a permission change, propose step-by-step changes and request an emulator/device test.

-- End of instructions
