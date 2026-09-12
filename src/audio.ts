/**
 * Sound, through Web Audio.
 *
 * It was HTMLAudioElement first — sixteen clips, a small pool of elements each,
 * about forty `<audio>` objects in total. That is fine on a desktop and it is
 * the reason this game ran at single-digit frames on an iPhone: iOS gives an
 * element a real audio pipeline, limits how many can exist, and charges for
 * every `play()`. The user said "it got slow when you added sound" on day one;
 * I A/B'd it on a laptop, measured no difference, and looked elsewhere for an
 * hour. The laptop was the wrong machine to ask.
 *
 * Web Audio has none of that shape: each clip is decoded ONCE into a buffer,
 * and playing it allocates a source node that the browser throws away. Overlap
 * is free, and there is nothing to pool.
 *
 * What still needs care:
 *
 * 1. **The context starts suspended.** Browsers block audio until a gesture,
 *    iOS strictest of all, and a SYNTHETIC click does not count — which is how
 *    a measurement run of mine ended up silently testing the muted case and
 *    reporting that sound was free.
 *
 * 2. **Repeated sounds need a floor on retriggering.** Four ballistas
 *    reloading together turn one thwip into a buzz.
 */

interface ClipSpec {
  volume: number;
  /** Minimum gap between retriggers, in ms. */
  throttle?: number;
}

const CLIPS: Record<string, ClipSpec> = {
  'tower-shot': { volume: 0.35, throttle: 45 },
  'cannon-shot': { volume: 0.4, throttle: 60 },
  'hit-enemy': { volume: 0.4, throttle: 30 },
  'enemy-shot': { volume: 0.3, throttle: 40 },
  'enemy-die': { volume: 0.5, throttle: 40 },
  swing: { volume: 0.45, throttle: 120 },
  'sword-hit': { volume: 0.55, throttle: 40 },
  'hero-hurt': { volume: 0.7, throttle: 200 },
  coin: { volume: 0.5, throttle: 40 },
  build: { volume: 0.6 },
  upgrade: { volume: 0.65 },
  denied: { volume: 0.5 },
  leak: { volume: 0.7 },
  wave: { volume: 0.6 },
  win: { volume: 0.8 },
  lose: { volume: 0.7 },
};

const MUSIC_VOLUME = 0.28;

type Ctx = AudioContext & { __umicat?: true };

export class GameAudio {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly lastPlayed = new Map<string, number>();
  private muted = false;

  /** Whether sound can actually be heard right now.
   *
   *  Asked of the context every time rather than cached in a flag. The cached
   *  version was the bug: `resume()` is asynchronous, the state is still
   *  'suspended' on the line after it, so the flag was set to false forever and
   *  the game was silent no matter how many times it was tapped. A derived
   *  answer cannot go stale. */
  private get ready(): boolean { return this.ctx?.state === 'running'; }

  constructor(private readonly base = 'audio/') {
    const unlock = (): void => {
      void this.start().then(() => {
        if (!this.ready) return;
        for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(ev, unlock);
      });
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      window.addEventListener(ev, unlock);
    }
    // iOS suspends the context when the app goes away, and it does not come
    // back on its own — without this, sound works until the first time someone
    // takes a call and then never again.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    });
  }

  private async start(): Promise<void> {
    if (this.ready) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC() as Ctx;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = MUSIC_VOLUME;
      this.musicGain.connect(this.master);
      void this.loadAll();
    }
    // `resume()` must be CALLED inside the gesture's call stack on iOS, and
    // awaited before anything asks whether it worked.
    try { await this.ctx.resume(); } catch { /* a blocked context is not fatal */ }
    if (this.ready) this.startMusic();
  }

  private async loadAll(): Promise<void> {
    // In parallel, and the music first.
    //
    // The first version fetched and decoded one at a time, out of caution about
    // decode cost on the main thread. The cost of the caution was that every
    // sound was late: the theme queued behind sixteen effects and started
    // nearly a second in, and the first few swings were silent because their
    // clip had not been decoded yet. `decodeAudioData` is asynchronous and off
    // the main thread in every engine that matters; the caution was for a
    // problem that does not exist, and it created a real one.
    const load = async (name: string): Promise<void> => {
      try {
        const res = await fetch(`${this.base}${name}.ogg`);
        const bytes = await res.arrayBuffer();
        const buf = await this.ctx!.decodeAudioData(bytes);
        // Tagged so a test can see WHICH clip played — a buffer has no name,
        // and "some audio happened" is not a check.
        (buf as AudioBuffer & { __name?: string }).__name = name;
        this.buffers.set(name, buf);
        if (name === 'bgm' && this.ready && !this.musicSource) this.startMusic();
      } catch {
        /* a clip that will not decode is not worth taking the game down for */
      }
    };
    await load('bgm');
    await Promise.all(Object.keys(CLIPS).map(load));
  }

  private startMusic(): void {
    if (!this.ctx || !this.musicGain || this.musicSource || this.muted) return;
    const buf = this.buffers.get('bgm');
    if (!buf) return;            // still decoding; loadAll will call back
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();
    this.musicSource = src;
  }

  play(name: string): void {
    const ctx = this.ctx;
    if (this.muted || !this.ready || !ctx || !this.master) return;
    const buf = this.buffers.get(name);
    if (!buf) return;
    const spec = CLIPS[name];
    const now = performance.now();
    const gap = spec?.throttle ?? 0;
    if (gap && now - (this.lastPlayed.get(name) ?? -1e9) < gap) return;
    this.lastPlayed.set(name, now);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = spec?.volume ?? 0.5;
    src.connect(g);
    g.connect(this.master);
    src.start();
    // Nodes disconnect themselves when they end; without this they pile up as
    // garbage the collector has to chase during play.
    src.onended = () => { src.disconnect(); g.disconnect(); };
  }

  /** Ducks the music for a moment — for a jingle that should be heard over it. */
  duck(seconds = 3): void {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
    this.musicGain.gain.linearRampToValueAtTime(MUSIC_VOLUME * 0.25, t + 0.2);
    this.musicGain.gain.linearRampToValueAtTime(MUSIC_VOLUME, t + seconds);
  }

  setMuted(on: boolean): void {
    this.muted = on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0 : 1, this.ctx.currentTime, 0.02);
    }
    if (!on && this.ready) this.startMusic();
  }

  get isMuted(): boolean { return this.muted; }
}
