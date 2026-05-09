import { eventBus } from "../utils/eventBus";

/**
 * AudioManager — Plays sound effects in response to PlaySound events.
 *
 * Features:
 *   - Throttling: Limits the same sound_id to MAX_CONCURRENT overlapping
 *     instances to prevent audio distortion when many players cast the
 *     same spell on the same frame.
 *   - Browser autoplay safety: Silently swallows NotAllowedError if the
 *     user hasn't interacted with the page yet.
 *   - Audio caching: Caches loaded Audio objects so we don't re-fetch
 *     the same file every time a sound plays.
 */
export class AudioManager {
  private readonly MAX_CONCURRENT = 2;

  /** Tracks how many instances of each sound_id are currently playing. */
  private activeCounts: Map<number, number> = new Map();

  /** Cache of loaded Audio elements keyed by sound_id. */
  private audioCache: Map<number, HTMLAudioElement> = new Map();

  /** EventBus unsubscribe functions. */
  private unsubs: (() => void)[] = [];

  constructor() {
    this.unsubs.push(
      eventBus.on("PlaySound", (data) => {
        this.play(data.sound_id);
      })
    );
  }

  private async play(soundId: number) {
    // Throttle: if too many instances of this sound are already playing, skip
    const current = this.activeCounts.get(soundId) ?? 0;
    if (current >= this.MAX_CONCURRENT) {
      return;
    }

    // Get or create the Audio element
    let audio = this.audioCache.get(soundId);
    if (!audio) {
      audio = new Audio(`/assets/sounds/${soundId}.mp3`);
      this.audioCache.set(soundId, audio);
    }

    // Clone the audio so we can play overlapping instances of the same sound.
    // A single HTMLAudioElement can only play once at a time.
    const instance = audio.cloneNode() as HTMLAudioElement;

    // Track this instance
    this.activeCounts.set(soundId, current + 1);

    // When playback ends, decrement the counter
    instance.addEventListener("ended", () => {
      const count = this.activeCounts.get(soundId) ?? 0;
      this.activeCounts.set(soundId, Math.max(0, count - 1));
    });

    // Play with autoplay safety — browsers block audio until user interaction
    try {
      await instance.play();
    } catch (err: any) {
      // NotAllowedError = autoplay blocked; swallow silently
      if (err?.name !== "NotAllowedError") {
        console.warn(`AudioManager: failed to play sound ${soundId}`, err);
      }
      // Decrement counter since we didn't actually start playing
      const count = this.activeCounts.get(soundId) ?? 0;
      this.activeCounts.set(soundId, Math.max(0, count - 1));
    }
  }

  destroy() {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    this.audioCache.clear();
    this.activeCounts.clear();
  }
}
