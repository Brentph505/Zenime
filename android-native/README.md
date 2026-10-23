# Zenime Native Android (Rust)

This is a separate Android client for Zenime. It does not replace the existing React/Vite website.

## Design and implementation

- Rust owns the catalog, search, anime details, episode lookup, and networking logic.
- Slint compiles the interface to native code; there is no WebView and no bundled HTML/JavaScript application.
- A Kotlin Android activity uses AndroidX Media3 / ExoPlayer for native HLS and direct MP4 playback.
- The interface follows the existing Zenime dark theme (#0d1117), muted panels (#161b22), and lavender accent.
- Results marked as adult by the metadata API are filtered out.
- The default metadata endpoint is the public example endpoint documented by the upstream Miruro project. If it is unavailable, change the endpoint in Settings to another compatible backend. Do not commit private API keys.

The native player accepts direct HLS and media URLs only. It does not load provider embed pages in a WebView. Some providers return embed-only sources; those episodes will show a message rather than silently opening a web page.

## Build prerequisites

Install Rust, Java 17, Android Studio or the Android SDK, Android NDK, CMake, Gradle 8.13, and cargo-ndk. The GitHub Actions workflow installs the Android build tools automatically.

## Build the APK locally

From this directory, install the Rust target and cargo-ndk:

    rustup target add aarch64-linux-android
    cargo install cargo-ndk --locked

Then build the native library:

    cargo ndk -t arm64-v8a -o android/app/src/main/jniLibs build --release --lib

Package the APK:

    cd android
    gradle --no-daemon :app:assembleDebug

The debug APK is written to android/app/build/outputs/apk/debug/app-debug.apk. It is intended for local testing and is not a Play Store release.

## GitHub Actions

Push changes to the android-rust-native branch, or use the workflow's manual run button. The workflow builds an arm64 Android APK and uploads it as the artifact named zenime-native-debug-apk. Download it from the completed Actions run.

For distribution, add a private release keystore to GitHub Actions secrets and create a separately signed release build. Never commit a keystore, password, API key, or signing secret.

## Current scope

The initial native client includes the home catalog, Trending / Popular / Top rated / Latest sections, title search, anime details, episode listing, a session-only saved library, and a Media3 player for direct HLS / MP4 streams. Metadata and stream links come from the configured backend; the app does not host or bundle video files.

This is an initial implementation. Provider compatibility, playback headers, and backend availability vary. Verify the app on a physical Android device and fix any build or runtime issues before treating it as a stable release.

## Attribution and license

Zenime is a non-commercial derivative of Miruro no Kuon. Keep the required attribution and non-commercial terms in the repository root LICENSE when modifying or redistributing the app. This native implementation is intended for non-commercial use.
