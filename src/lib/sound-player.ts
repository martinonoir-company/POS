"use client";

/**
 * Tiny self-contained sound player for POS alerts.
 *
 * Uses the Web Audio API to synthesise a short two-tone chime, so there is
 * no audio asset to ship or 404 on. Designed to never throw: browsers block
 * audio until the user has interacted with the page, so play() swallows the
 * resulting errors and simply no-ops when audio isn't permitted yet.
 *
 * A single shared AudioContext is reused (created lazily on first play) to
 * avoid exhausting the browser's context limit.
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Play one tone at `freq` Hz starting at `at` seconds, lasting `dur`. */
function tone(audio: AudioContext, freq: number, at: number, dur: number) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  // Quick attack + decay so it sounds like a notification, not a drone.
  gain.gain.setValueAtTime(0.0001, audio.currentTime + at);
  gain.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + at + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    audio.currentTime + at + dur,
  );
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(audio.currentTime + at);
  osc.stop(audio.currentTime + at + dur);
}

/**
 * Play the dispatch alert chime. Safe to call from any event handler — it
 * resumes a suspended context and never throws.
 */
export function playDispatchAlert(): void {
  const audio = getCtx();
  if (!audio) return;
  try {
    if (audio.state === "suspended") void audio.resume();
    // Two ascending tones — a friendly "new order" cue.
    tone(audio, 660, 0, 0.18);
    tone(audio, 880, 0.2, 0.28);
  } catch {
    // Autoplay blocked or context unavailable — ignore.
  }
}

/**
 * Prime the audio context on a user gesture (e.g. login click) so later
 * programmatic plays are allowed by the browser's autoplay policy.
 */
export function primeAudio(): void {
  const audio = getCtx();
  if (audio && audio.state === "suspended") void audio.resume();
}
