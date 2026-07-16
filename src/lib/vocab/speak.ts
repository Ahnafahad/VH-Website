// Cross-device word pronunciation via the Web Speech API.
//
// LexiCore ships on desktop browsers, iOS Safari/WKWebView, and — via the
// remote-shell Capacitor APK — the Android System WebView. Android WebView is
// the flaky surface: getVoices() frequently returns [] and never fires
// 'voiceschanged', and speech can start paused. This helper is hardened for all
// of them while staying synchronous so the speak() call remains inside the
// user-gesture that iOS requires.

/** Speak a single word aloud. Best-effort: never throws, no-ops where unsupported. */
export function speak(text: string): void {
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;

  const synth = window.speechSynthesis;
  try {
    // Clear any queued/stuck utterance from a previous tap.
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.82;

    // Use an English voice when the list is populated; otherwise fall back to
    // the engine default — which still speaks, even when getVoices() is [].
    const enVoice = synth.getVoices().find(v => /^en/i.test(v.lang));
    if (enVoice) utterance.voice = enVoice;

    synth.speak(utterance);

    // Chrome/WebView bug: speech can enter a paused state on start — nudge it.
    if (synth.paused) synth.resume();
  } catch {
    // Pronunciation is a nicety; a failure must never break the tap.
  }
}
