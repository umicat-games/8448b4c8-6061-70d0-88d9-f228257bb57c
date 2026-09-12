/**
 * Sound.
 *
 * Deliberately small: HTMLAudioElement, no Web Audio graph, no mixing. A
 * tower defense needs a dozen short clips and one loop, and the browser is
 * already good at that.
 *
 * Three things here are not obvious and all three are the difference between
 * "sound works" and "sound works on a phone":
 *
 * 1. **Nothing may play before the player touches the screen.** Browsers block
 *    audio until a gesture, and iOS is strictest. So the music waits for the
 *    first input and starts itself then, rather than failing at load with an
 *    unhandled promise rejection in the console and silence forever.
 *
 * 2. **One Audio element per clip cannot overlap itself.** Two towers firing
 *    in the same frame would cut each other off. Each clip keeps a small pool
 *    and rotates through it.
 *
 * 3. **Repeated sounds need a floor on how often they retrigger.** Four
 *    ballistas reloading together turn one "thwip" into a buzz; a few tens of
 *    milliseconds of cooldown per clip fixes it without anyone noticing a
 *    dropped shot.
 */

interface ClipSpec {
  /** Relative volume, 0-1. Balanced by ear against the music. */
  volume: number;
  /** How many can overlap. Rapid sounds need more. */
  voices?: number;
  /** Minimum gap between retriggers, in ms. */
  throttle?: number;
}

const CLIPS: Record<string, ClipSpec> = {
  'tower-shot': { volume: 0.35, voices: 4, throttle: 45 },
  'cannon-shot': { volume: 0.4, voices: 3, throttle: 60 },
  'hit-enemy': { volume: 0.4, voices: 4, throttle: 30 },
  'enemy-shot': { volume: 0.3, voices: 4, throttle: 40 },
  'enemy-die': { volume: 0.5, voices: 3, throttle: 40 },
  swing: { volume: 0.45, voices: 2, throttle: 120 },
  'sword-hit': { volume: 0.55, voices: 3, throttle: 40 },
  'hero-hurt': { volume: 0.7, voices: 2, throttle: 200 },
  coin: { volume: 0.5, voices: 4, throttle: 40 },
  build: { volume: 0.6 },
  upgrade: { volume: 0.65 },
  denied: { volume: 0.5 },
  leak: { volume: 0.7 },
  wave: { volume: 0.6 },
  win: { volume: 0.8 },
  lose: { volume: 0.7 },
};

export class GameAudio {
  private readonly pools = new Map<string, HTMLAudioElement[]>();
  private readonly next = new Map<string, number>();
  private readonly lastPlayed = new Map<string, number>();
  private music: HTMLAudioElement | null = null;
  private muted = false;
  private unlocked = false;

  constructor(private readonly base = 'audio/') {
    for (const [name, spec] of Object.entries(CLIPS)) {
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < (spec.voices ?? 1); i++) {
        const a = new Audio(`${this.base}${name}.ogg`);
        a.preload = 'auto';
        a.volume = spec.volume;
        pool.push(a);
      }
      this.pools.set(name, pool);
    }

    this.music = new Audio(`${this.base}bgm.ogg`);
    this.music.loop = true;
    this.music.volume = 0.28;
    this.music.preload = 'auto';

    // The gesture that unlocks everything. `once` per event, and all of them
    // removed together — a game that keeps listening after unlocking would
    // restart the music every time the player taps.
    const unlock = (): void => {
      this.unlocked = true;
      if (!this.muted) void this.music?.play().catch(() => { /* still blocked; try again next gesture */ });
      if (this.music && !this.music.paused) {
        for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
          window.removeEventListener(ev, unlock);
        }
      }
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      window.addEventListener(ev, unlock);
    }
  }

  play(name: keyof typeof CLIPS | string): void {
    if (this.muted || !this.unlocked) return;
    const pool = this.pools.get(name);
    if (!pool) return;
    const now = performance.now();
    const gap = CLIPS[name]?.throttle ?? 0;
    if (gap && now - (this.lastPlayed.get(name) ?? -1e9) < gap) return;
    this.lastPlayed.set(name, now);

    const i = (this.next.get(name) ?? 0) % pool.length;
    this.next.set(name, i + 1);
    const a = pool[i];
    try {
      a.currentTime = 0;
      void a.play().catch(() => { /* a clip that will not play is not worth a crash */ });
    } catch { /* currentTime can throw while a clip is still loading */ }
  }

  /** Ducks the loop for a moment — for a jingle that should be heard over it. */
  duck(seconds = 3): void {
    if (!this.music) return;
    const from = this.music.volume;
    this.music.volume = from * 0.25;
    setTimeout(() => { if (this.music) this.music.volume = from; }, seconds * 1000);
  }

  setMuted(on: boolean): void {
    this.muted = on;
    if (!this.music) return;
    if (on) this.music.pause();
    else if (this.unlocked) void this.music.play().catch(() => {});
  }

  get isMuted(): boolean { return this.muted; }
}
