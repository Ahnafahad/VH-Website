# LexiCore Android App

LexiCore uses Capacitor 8 and the production Next.js application as its shared product layer. A bundled recovery shell is available when the remote application cannot start.

## Native integrations

- Native Google sign-in through Credential Manager and the NextAuth token bridge.
- Android back-button and lifecycle handling.
- Verified HTTPS links and the `org.beyondthehorizons.vhapp` custom scheme.
- Notification-tap routing into LexiCore destinations.
- Native haptics and Android share sheet.
- Edge-to-edge dark system bars, splash screen, and safe-area-aware web UI.
- Branded connection recovery and session restoration.

## Build

Requirements: JDK 17, Android SDK API 36, Node.js, and npm.

```powershell
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Signed release

Set these environment variables:

```text
LEXICORE_KEYSTORE_PATH
LEXICORE_KEYSTORE_PASSWORD
LEXICORE_KEY_ALIAS
LEXICORE_KEY_PASSWORD
```

Then run:

```powershell
cd android
.\gradlew.bat bundleRelease
```

The Gradle build enables code and resource shrinking for release builds. Secrets are read only from the environment.

## Deep links

The manifest accepts `https://www.vh-beyondthehorizons.org/vocab/*` and the custom application scheme. Verified HTTPS links additionally require a production `/.well-known/assetlinks.json` containing the release certificate fingerprint.

## Release gates

- Signed AAB from the production keystore.
- Hosted asset-links file and verified navigation.
- Native Google sign-in and push routing tested on a physical device.
- Privacy policy and Play Console Data Safety form complete.
- Phone/tablet screenshots and feature graphic uploaded.
- Closed-track testing completed before production rollout.
