/**
 * This game's sound: which clips, how loud, and how often each may retrigger.
 *
 * Everything hard about web audio — Web Audio instead of `<audio>` elements
 * (forty of those took this game to 11fps on an iPhone), the gesture unlock,
 * the asynchronous `resume()`, iOS suspending the context when the app goes
 * away — lives in `GameAudio` in the SDK now. Every 3D game needs all of it
 * and none of the failures are visible anywhere a creator would look.
 */
import { GameAudio, type AudioClipSpec } from '@umicat/three-sdk';

const CLIPS: Record<string, AudioClipSpec> = {
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


export const createAudio = (): GameAudio =>
  new GameAudio({ clips: CLIPS, base: 'audio/', music: 'bgm', musicVolume: 0.28 });
