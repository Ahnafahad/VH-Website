# LexiCore Premium Upgrade — Completion Audit

## Verified implementation

### Retention upgrade — Phases 1–3

- Durable activation is now defined as a correct tested-recall answer during the first session, with `activated_at`, learning goal, and onboarding completion timestamps stored in user progress.
- Typed retention events cover onboarding, starter-word exposure, first recall, activation, session start/completion/restoration, review completion, recommendations, and notification outcomes.
- Admin analytics exposes activation rate, median time-to-value, completed/restored sessions, and D1/D7/D30 tested-recall retention cohorts.
- Onboarding now asks one useful goal question, establishes a pace, teaches three real words, requires tested recall, and shows a specific first-win result. The feature tour no longer blocks first value and remains available from Help.
- Home now computes one adaptive next action in this order: genuinely interrupted quiz, due review, interrupted learning, prepared recall quiz, weak-word repair, then new learning. Every recommendation explains why it matters, its approximate duration, and the expected learning outcome.
- Production components were visually inspected at 390px and 1440px with reduced motion; no horizontal overflow was detected. Goal selection, card reveal, recall selection, and adaptive Home hierarchy were inspected and refined.
- Verification after these phases: 20 test files / 168 tests pass, TypeScript passes, the Next.js production build succeeds, and Capacitor Android sync succeeds with all eight plugins.

| Requirement | Evidence |
|---|---|
| Product and design direction | `PRODUCT.md`, `DESIGN.md`; existing L identity explicitly preserved |
| Premium typography and contrast | Build-time Sora/Cormorant fonts, semantic LexiCore tokens, improved muted/disabled contrast |
| Accessibility | Zoom restored, focus states, 44px controls, reduced-motion and larger-text settings, keyboard quiz controls |
| Connection and route recovery | `ConnectionStatus`, bundled Android recovery shell, route-wide error boundary |
| Android app behavior | Capacitor App/Browser/Haptics/Share/Push plugins, back behavior, lifecycle, deep-link and notification routing |
| Android identity | LexiCore app/activity labels, dark system bars, existing approved L used for PWA and launcher icons |
| Android updates | Required/optional version endpoint and native Play Store prompt |
| Release security | Environment-only signing config, R8/resource shrinking, no committed credentials |
| Learning reliability | Flashcard/practice duplicate guards, atomic quiz answers, unique answer constraint and migration |
| AI independence | Deterministic quiz fallback when DeepSeek and Gemini are unavailable |
| Session restoration | Quiz session, question position, questions, and earned points recover for six hours |
| Home hierarchy | Action-first mobile layout; weekly recall challenge from authoritative answer data |
| Interruption reduction | Daily dossier is full-screen once, then becomes an optional compact brief |
| Learning feedback | Pronunciation, explanatory quiz feedback, native sound/haptics, privacy-safe milestone sharing |
| Accessibility preferences | Persistent reduced-motion and larger-text controls in Settings |
| Observability | FCP, LCP, TTFB, long-task, client-error, and rejection telemetry |
| Documentation | Current Android guide, Play Store copy, signing variables, release checklist |
| Web compilation | `next build` succeeds with Next.js 15.5.9 |
| Automated verification | 19 test files and 164 tests pass; TypeScript passes; diff check passes |
| Capacitor synchronization | Eight native plugins discovered and Android sync succeeds |

## External release gates

These cannot be completed or truthfully verified from the repository alone:

1. A production signing keystore and the four `LEXICORE_KEYSTORE_*` secrets.
2. Firebase `google-services.json` plus server credentials for actual native FCM delivery.
3. Google Play Console access for the Data Safety form, privacy-policy entry, listing assets, testing tracks, and rollout.
4. The release certificate SHA-256 fingerprint, required to host the final `/.well-known/assetlinks.json`.
5. Physical low/mid-range Android hardware for TalkBack, notification, process-death, keyboard, frame-rate, and weak-network testing.
6. A real Android SDK/Gradle build environment. The current environment repeatedly failed downloading Gradle because external network transfers timed out; a resumable download was later denied by the execution-usage gate.

## Required production configuration

```text
LEXICORE_ANDROID_LATEST_VERSION
LEXICORE_ANDROID_MINIMUM_VERSION
LEXICORE_ANDROID_STORE_URL
LEXICORE_KEYSTORE_PATH
LEXICORE_KEYSTORE_PASSWORD
LEXICORE_KEY_ALIAS
LEXICORE_KEY_PASSWORD
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

Native FCM additionally requires Firebase files/credentials supplied outside source control.
