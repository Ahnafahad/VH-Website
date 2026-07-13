# LexiCore Release Guide

## Store identity

- App name: LexiCore
- Short description: Build lasting vocabulary with smart review and active recall.
- Category: Education
- Website: https://www.vh-beyondthehorizons.org/vocab
- Privacy policy: must be supplied in Play Console before production release.

## Full store description

LexiCore helps learners turn difficult English words into durable knowledge. Study focused flashcards, test active recall, review words at the right time, and follow clear mastery progress from New to Mastered. Sessions are short, resumable, and designed for admission preparation and everyday English learning.

Features include adaptive review, typed recall, contextual examples, pronunciation, progress and streak tracking, focused practice, achievements, and privacy-safe milestone sharing.

## Required release environment

```text
LEXICORE_KEYSTORE_PATH
LEXICORE_KEYSTORE_PASSWORD
LEXICORE_KEY_ALIAS
LEXICORE_KEY_PASSWORD
```

The keystore and credentials must never be committed.

## External Play Console work

1. Host `/.well-known/assetlinks.json` for verified links using the release certificate SHA-256 fingerprint.
2. Supply the privacy-policy URL and complete the Data Safety form.
3. Upload phone and tablet screenshots captured from a signed release build.
4. Upload the feature graphic and existing approved LexiCore icon assets.
5. Run closed testing on physical low/mid-range Android devices before production rollout.

## Release commands

```powershell
npm run cap:sync
cd android
.\gradlew.bat bundleRelease
```

Release output: `android/app/build/outputs/bundle/release/app-release.aab`.
