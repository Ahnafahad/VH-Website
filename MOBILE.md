# Beyond the Horizons — Android App

## Architecture

This is a **remote-URL WebView shell** using Capacitor. The Android app loads
the production website (`https://www.vh-beyondthehorizons.org`) inside a native
WebView. No web code is bundled or duplicated — the existing Next.js app is the
single source of truth. `mobile/www/index.html` is only an offline-fallback
placeholder (shown when there is no internet connection before Capacitor can
reach the remote server).

## Prerequisites

- **JDK 17** (OpenJDK or Temurin) — must be on PATH
- **Android Studio** (Hedgehog or newer) with Android SDK (API 34+) installed
- **ANDROID_HOME** environment variable set, or `local.properties` in `android/`
- Node.js 18+ and npm already in use for the web app

## Build steps

### 1. Sync web assets to Android

Run this after any change to `capacitor.config.ts` or native dependencies:

```bash
npm run cap:sync        # equivalent to: npx cap sync android
```

### 2. Build a debug APK

```bash
cd android
.\gradlew assembleDebug          # Windows
./gradlew assembleDebug          # macOS / Linux
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Build a release AAB (for Play Store)

```bash
cd android
.\gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

> The release AAB must be signed before uploading to Play Store (see Signing below).

### 4. Open in Android Studio

```bash
npm run android:open    # equivalent to: npx cap open android
```

Android Studio will detect the Gradle project automatically.

## Signing for Play Store

### Generate a release keystore (do this once, keep it secret)

```bash
keytool -genkeypair \
  -v \
  -keystore vh-release.keystore \
  -alias vh-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Store `vh-release.keystore` securely — **never commit it to git**.

### Configure signing in Gradle

Edit `android/app/build.gradle` and add inside `android { ... }`:

```groovy
signingConfigs {
    release {
        storeFile file(System.getenv("KEYSTORE_PATH") ?: "../vh-release.keystore")
        storePassword System.getenv("KEYSTORE_PASSWORD") ?: ""
        keyAlias System.getenv("KEY_ALIAS") ?: "vh-key"
        keyPassword System.getenv("KEY_PASSWORD") ?: ""
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

Pass secrets via environment variables in CI — never hard-code passwords.

## Google OAuth caveat

Google OAuth **does not work in plain WebViews** (Google blocks this).
When adding sign-in to the Android app, use
[`@capacitor/browser`](https://capacitorjs.com/docs/apis/browser) to open the
Google sign-in flow in a Custom Chrome Tab, then redirect back to the app via a
deep-link scheme. Do NOT attempt to handle Google OAuth inside the WebView.

## Play Store readiness checklist

- [ ] Signed AAB built with release keystore
- [ ] `targetSdkVersion` >= 34 (set in `android/app/build.gradle`)
- [ ] Privacy Policy URL added to Play Console listing
- [ ] App icons generated (`@capacitor/assets` can generate all required sizes from a single source image)
- [ ] Splash screen configured (`@capacitor/splash-screen`)
- [ ] Google OAuth replaced with Custom Tabs sign-in (`@capacitor/browser`)
- [ ] Test on a physical device or emulator (API 34+)
- [ ] Complete Play Console data safety form (app loads remote content — declare accordingly)
- [ ] Short description (max 80 chars) and full description ready for store listing

## File layout

```
android/                   Capacitor-generated Android Studio project (source)
  app/src/main/
    AndroidManifest.xml    Declares INTERNET permission, activity, FileProvider
    res/values/strings.xml App name: "Beyond the Horizons"
  app/build.gradle         Target SDK, dependencies, signing config goes here
mobile/www/index.html      Offline-fallback page (shown without internet)
capacitor.config.ts        Capacitor config — production URL, appId, webDir
```
