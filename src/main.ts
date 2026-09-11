import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  ThreeUmicat, loadScene3D, CharacterController3D, Input3D,
  type Scene3D, type Manifest3D, type LoadedScene3D,
} from '@umicat/three-sdk';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

/**
 * A 3D Umicat game.
 *
 * Everything host-facing — who the player is, their cloud save, shared game
 * data, multiplayer, runtime AI, voice — comes from `umicat.*` and is identical
 * to what a 2D game gets, because it is literally the same package underneath.
 * What differs is only how the world is drawn.
 *
 * Start here: `SAVE_KEY`, the scene JSON in `public/scenes3d/`, and `update()`.
 */

const SAVE_KEY = 'progress';

// The crystals scattered around the arena (see public/scenes3d/main.json) — a
// short, complete collect-a-thon: grab all of them and the round is cleared.
// Not persisted: which crystals are left is current-run state, like the
// player's position mid-level, and resets on reload same as a fresh round would.
const CRYSTAL_IDS = [
  'crystal_g1', 'crystal_g2', 'crystal_g3', 'crystal_g4', 'crystal_g5',
  'crystal_low', 'crystal_mid', 'crystal_tall',
];
const PICKUP_RADIUS = 1.0;

async function start(): Promise<void> {
  // 1) The platform. Do this first: reading the save before the first frame is
  //    what makes a reload resume instead of restart.
  const umicat = await ThreeUmicat.init();

  // 2) Physics. Rapier is WASM and must be initialised before use.
  await RAPIER.init();

  // 3) The world, from design data on disk. Nothing here runs game logic —
  //    same separation the 2D editor relies on (ADR-021).
  const [manifest, scene3d] = await Promise.all([
    fetch('scenes3d/manifest.json').then((r) => r.json() as Promise<Manifest3D>),
    fetch('scenes3d/main.json').then((r) => r.json() as Promise<Scene3D>),
  ]);
  const world = await loadScene3D(scene3d, manifest, { assetBase: '', rapier: RAPIER });

  const hero = world.entities.get('hero')!;
  const saved = (await umicat.saves.get<{ x: number; y: number; z: number }>(SAVE_KEY)) ?? null;

  const character = new CharacterController3D(world.world, RAPIER, {
    position: saved ?? { x: 0, y: 1, z: 4 },
    speed: 4.5,
    stepHeight: 0.4,
  });
  const input = new Input3D();

  // 4) Render. The canvas is in index.html; the game owns the loop.
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const hud = document.getElementById('hud')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const resize = (): void => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    world.camera.aspect = window.innerWidth / window.innerHeight;
    world.camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const greetingEl = document.createElement('div');
  greetingEl.id = 'greeting';
  greetingEl.textContent = umicat.user ? `Hello, ${umicat.user.name}` : 'Playing as a guest';
  const scoreEl = document.createElement('div');
  scoreEl.id = 'score';
  hud.append(greetingEl, scoreEl);

  // Crystals: entities with no collider (decoration) — picked up by proximity,
  // not physics. Filter out any id missing from the scene so a future edit to
  // main.json can't silently crash the loop.
  const crystals = CRYSTAL_IDS
    .map((id) => world.entities.get(id))
    .filter((obj): obj is THREE.Object3D => obj !== undefined);
  const collected = new Set<THREE.Object3D>();
  const crystalWorldPos = new THREE.Vector3();
  const total = crystals.length;

  const renderScore = (bump: boolean): void => {
    const cleared = collected.size >= total;
    scoreEl.textContent = cleared ? `Crystals: ${total}/${total} — Cleared!` : `Crystals: ${collected.size}/${total}`;
    scoreEl.classList.toggle('cleared', cleared);
    if (bump) {
      scoreEl.classList.remove('bump');
      // Force reflow so re-adding the class retriggers the transition.
      void scoreEl.offsetWidth;
      scoreEl.classList.add('bump');
    }
  };
  renderScore(false);

  // Saving every frame would hammer the host; coalesce instead.
  let pending: ReturnType<typeof setTimeout> | undefined;
  const save = (): void => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      const p = character.position;
      void umicat.saves.set(SAVE_KEY, { x: p.x, y: p.y, z: p.z });
    }, 500);
  };

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const dir = input.direction();

    character.update(dt, dir);
    character.syncTo(hero, -0.85);          // capsule centre → the model's feet
    character.faceTowards(hero, dir, dt);
    if (Math.hypot(dir.x, dir.z) > 0) save();

    if (collected.size < total) {
      const p = character.position;
      for (const crystal of crystals) {
        if (collected.has(crystal)) continue;
        crystal.getWorldPosition(crystalWorldPos);
        const dx = crystalWorldPos.x - p.x;
        const dy = crystalWorldPos.y - p.y;
        const dz = crystalWorldPos.z - p.z;
        if (dx * dx + dy * dy + dz * dz <= PICKUP_RADIUS * PICKUP_RADIUS) {
          collected.add(crystal);
          crystal.visible = false;
          renderScore(true);
        }
      }
    }

    world.update(dt);                        // animation + physics + follow camera
    renderer.render(world.scene, world.camera);
  });

  // Handy while developing; harmless in a published build.
  Object.assign(window as unknown as Record<string, unknown>,
    { __game: { umicat, world, character, input } as unknown });
}

void start().catch((err) => {
  // A 3D game that fails to boot should say so rather than show a black canvas.
  const hud = document.getElementById('hud');
  if (hud) hud.textContent = `Failed to start: ${String(err)}`;
  console.error('[umicat] game failed to start', err);
});

// Referenced so the design canvas is not silently unused; a game that letterboxes
// itself will want these.
void GAME_WIDTH; void GAME_HEIGHT;
