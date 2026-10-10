# Howler

## Installed version
`howler` 2.2.4; `@types/howler` 2.2.13.

## Repository
`.references/howler/`, pinned v2.2.4; [upstream](https://github.com/goldfire/howler.js).

## Role in Last Word
Optional audible reactions to context arrival, selection, switching, locking, feedback, mastery, and UI events.

## Use this when
Managing browser sound loading, sprite playback, volume/mute, short overlapping cues, and cleanup.

## Do NOT use this when
Advancing game state on sound `end`, enforcing learning timers, generating final audio assets during bootstrap, or making sound the sole clue.

## Important APIs/components/hooks
`Howl`, `Howler`, `play`, `stop`, `mute`, `volume`, `state`, `unload`; `preload`, `sprite`, `onloaderror`, `onplayerror`, `unlock`. Prefer the Web Audio path for short cues; HTML5 Audio is available for appropriate streaming cases.

## Relevant official examples
- `.references/howler/README.md` (Core, Mobile/Chrome Playback, group playback)
- `.references/howler/examples/sprite/sprite.js`
- `.references/howler/examples/player/player.js`
- `.references/howler/src/howler.core.js`

## Last Word examples
A meaningful lock event can play a short cue if sound is enabled. A missed/blocked playback never prevents the lock. The smoke test constructs one unloaded silent Howl with `preload: false` and cleans it up; it intentionally does not verify real sound playback.

## Performance considerations
Reuse audio instances, bound overlap, load sounds by session, and unload owned resources on cleanup. Avoid creating one Howl per render or repeated React Strict Mode effect leaks. Keep autoplay/unlock handling explicit.

## Accessibility considerations
Audio and haptics are independently optional. Provide equivalent visible state and feedback. Mobile browsers may require a user gesture; handle rejection without blocking interaction. Host CSP currently favors same-origin media; use approved assets later.

## Common mistakes
Assuming construction proves playback, autoplay before interaction, module-level browser access in SSR, global `Howler.unload()` when other app audio is active, and coupling state transitions to audio callbacks.

## Relationship to other libraries in our stack
XState produces semantic events, Zustand stores sound preference, and Howler presents sound. The host's existing haptics integration remains separate.
