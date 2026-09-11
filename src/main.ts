import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  ThreeUmicat, loadScene3D, CharacterController3D, CharacterAnimator, Input3D,
  type Scene3D, type Manifest3D, type LoadedScene3D,
} from '@umicat/three-sdk';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

/**
 * Woodland Brawl — a small action arena. Chase off the critters, don't get
 * chipped down to zero hearts, use the jump platforms to reach the guard
 * perched up top.
 *
 * Start here: `PLAYER_MAX_HP`, `ENEMY_DEFS`, and the frame loop in `start()`.
 */

const SAVE_KEY = 'highScore';

const SPAWN = { x: 0, y: 0.4, z: 1.7 };
const RESPAWN_BELOW_Y = -5;

const PLAYER_MAX_HP = 5;
const PLAYER_HALF_HEIGHT = 0.2;
const PLAYER_RADIUS = 0.16;
const PLAYER_SYNC_OFFSET = -(PLAYER_HALF_HEIGHT + PLAYER_RADIUS); // capsule centre -> feet

const ATTACK_RANGE = 0.95;
const ATTACK_CONE_COS = 0.4; // ~66 degrees half-angle either side of facing
const HIT_INVINCIBLE_SECONDS = 1.0;
const CONTACT_RANGE = 0.55;
const CONTACT_COOLDOWN_SECONDS = 1.0;

// Every critter shares a capsule sized for the kit's blob characters (they
// stand a bit taller than the hero's own capsule).
const ENEMY_HALF_HEIGHT = 0.26;
const ENEMY_RADIUS = 0.19;
const ENEMY_SYNC_OFFSET = -(ENEMY_HALF_HEIGHT + ENEMY_RADIUS);

interface EnemyDef {
  id: string;
  modelAssetId: string;
  spawn: { x: number; y: number; z: number };
  /** How far it will stray from its spawn point while chasing — keeps the
   *  platform guard from walking off the edge after the player. */
  leash: number;
  detectRadius: number;
  speed: number;
  hp: number;
}

const ENEMY_DEFS: EnemyDef[] = [
  { id: 'enemy_oobi', modelAssetId: 'enemy-oobi', spawn: { x: -2.0, y: 0.5, z: -0.5 }, leash: 3.2, detectRadius: 3.4, speed: 1.1, hp: 2 },
  { id: 'enemy_oodi', modelAssetId: 'enemy-oodi', spawn: { x: 2.0, y: 0.5, z: 2.6 }, leash: 3.2, detectRadius: 3.4, speed: 1.1, hp: 2 },
  { id: 'enemy_ooli', modelAssetId: 'enemy-ooli', spawn: { x: -3.6, y: 0.5, z: 3.6 }, leash: 3.2, detectRadius: 3.4, speed: 1.15, hp: 2 },
  { id: 'enemy_oopi', modelAssetId: 'enemy-oopi', spawn: { x: 0.0, y: 0.5, z: -4.6 }, leash: 3.2, detectRadius: 3.4, speed: 1.15, hp: 2 },
  // Stationed on the top platform — its leash is short enough that it never
  // wanders off the edge; the player has to climb up to reach it.
  { id: 'enemy_oozi', modelAssetId: 'enemy-oozi', spawn: { x: 5.4, y: 1.75, z: -3.0 }, leash: 0.35, detectRadius: 3.4, speed: 1.0, hp: 2 },
];

interface EnemyRuntime {
  def: EnemyDef;
  controller: CharacterController3D;
  mesh: THREE.Object3D;
  animator: CharacterAnimator | null;
  alive: boolean;
  dying: boolean;
  hp: number;
  hitCooldown: number; // seconds until this enemy can deal contact damage again
  dieTimer: number;
}

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
  const bestScore = (await umicat.saves.get<number>(SAVE_KEY)) ?? 0;

  const character = new CharacterController3D(world.world, RAPIER, {
    position: SPAWN,
    halfHeight: PLAYER_HALF_HEIGHT,
    radius: PLAYER_RADIUS,
    speed: 1.9,
    stepHeight: 0.17,
    jumpSpeed: 2.8,
  });
  const input = new Input3D();

  const heroMixer = world.mixerFor.get('hero');
  const clipMap: Record<string, string> =
    (manifest.models?.find((m) => m.id === 'hero') as { animations?: Record<string, string> } | undefined)?.animations ?? {};
  const animator = heroMixer
    ? new CharacterAnimator(heroMixer, world.clips.get('hero') ?? [], clipMap)
    : null;

  // Enemies: one CharacterController3D each, driven by a tiny chase-with-a-
  // leash AI rather than input. Same controller the player uses, so they get
  // the same wall/step/ground behaviour for free.
  const enemies: EnemyRuntime[] = ENEMY_DEFS.map((def) => {
    const mesh = world.entities.get(def.id)!;
    const controller = new CharacterController3D(world.world, RAPIER, {
      position: def.spawn,
      halfHeight: ENEMY_HALF_HEIGHT,
      radius: ENEMY_RADIUS,
      speed: def.speed,
      stepHeight: 0.17,
      jumpSpeed: 0,
    });
    const mixer = world.mixerFor.get(def.id);
    const clips = world.clips.get(def.modelAssetId) ?? [];
    const enemyClipMap =
      (manifest.models?.find((m) => m.id === def.modelAssetId) as { animations?: Record<string, string> } | undefined)?.animations ?? {};
    const enemyAnimator = mixer ? new CharacterAnimator(mixer, clips, enemyClipMap) : null;
    return {
      def, controller, mesh, animator: enemyAnimator,
      alive: true, dying: false, hp: def.hp, hitCooldown: 0, dieTimer: 0,
    };
  });
  const totalEnemies = enemies.length;

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

  // --- HUD: hearts + kill counter, appended as children so we never wipe
  // the SDK's own touch controls with a stray hud.textContent. ---
  const heartsEl = document.createElement('div');
  heartsEl.style.fontSize = '20px';
  heartsEl.style.letterSpacing = '2px';
  hud.appendChild(heartsEl);

  const killsEl = document.createElement('div');
  killsEl.style.marginTop = '4px';
  hud.appendChild(killsEl);

  const bestEl = document.createElement('div');
  bestEl.style.marginTop = '2px';
  bestEl.style.opacity = '0.8';
  bestEl.style.fontSize = '13px';
  hud.appendChild(bestEl);

  let playerHP = PLAYER_MAX_HP;
  let killCount = 0;
  const renderHud = (): void => {
    heartsEl.textContent = '❤️'.repeat(Math.max(playerHP, 0)) + '🤍'.repeat(Math.max(PLAYER_MAX_HP - playerHP, 0));
    killsEl.textContent = `Defeated ${killCount} / ${totalEnemies}`;
    bestEl.textContent = `Best: ${bestScore}`;
  };
  renderHud();

  // --- End-of-run overlay (win or lose), with a retry button. Lives in the
  // HUD but re-enables pointer events for itself since #hud is click-through. ---
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
    flex-direction: column; gap: 14px; background: rgba(10, 20, 15, 0.55);
    pointer-events: auto; color: #fff; text-align: center; font: 600 20px/1.4 system-ui, sans-serif;
  `;
  const overlayTitle = document.createElement('div');
  overlayTitle.style.fontSize = '34px';
  const overlaySubtitle = document.createElement('div');
  overlaySubtitle.style.fontSize = '16px';
  overlaySubtitle.style.opacity = '0.85';
  const retryBtn = document.createElement('button');
  retryBtn.textContent = 'Play Again';
  retryBtn.style.cssText = `
    pointer-events: auto; padding: 12px 28px; font: 600 18px system-ui, sans-serif;
    border-radius: 999px; border: none; background: #ffd23f; color: #241a00; cursor: pointer;
  `;
  retryBtn.addEventListener('click', () => window.location.reload());
  overlay.appendChild(overlayTitle);
  overlay.appendChild(overlaySubtitle);
  overlay.appendChild(retryBtn);
  hud.appendChild(overlay);

  let gameOver = false;
  const endRun = (won: boolean): void => {
    if (gameOver) return;
    gameOver = true;
    overlayTitle.textContent = won ? 'Cleared the glade!' : 'Knocked out';
    overlaySubtitle.textContent = won
      ? `Every critter down. Score: ${killCount}`
      : `Defeated ${killCount} of ${totalEnemies} before going down.`;
    overlay.style.display = 'flex';
    if (killCount > bestScore) {
      void umicat.saves.set(SAVE_KEY, killCount).catch((err) => console.warn('[umicat] save failed', err));
    }
  };

  // --- A screen-edge flash on taking a hit — cheap, immediate feedback that
  // doesn't need any art. ---
  const hitFlash = document.createElement('div');
  hitFlash.style.cssText = `
    position: fixed; inset: 0; pointer-events: none; background: rgba(220, 30, 30, 0);
    transition: background 120ms ease-out;
  `;
  document.body.appendChild(hitFlash);
  const flashHit = (): void => {
    hitFlash.style.background = 'rgba(220, 30, 30, 0.35)';
    setTimeout(() => { hitFlash.style.background = 'rgba(220, 30, 30, 0)'; }, 120);
  };

  // --- Touch attack button. Input3D already gives us a thumbstick + jump on
  // phones; the swing is game-specific, so we build this one ourselves. ---
  const attackBtn = document.createElement('button');
  attackBtn.textContent = '⚔';
  attackBtn.style.cssText = `
    position: fixed; right: 22px; bottom: 26px; width: 68px; height: 68px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.6); background: rgba(20,20,20,0.45); color: #fff;
    font-size: 28px; z-index: 5; touch-action: none; -webkit-tap-highlight-color: transparent;
  `;
  document.body.appendChild(attackBtn);

  // Saving high scores is cheap and only on the score, so no coalescing needed
  // here — writes only happen once, at the end of a run (see endRun).

  const forward = new THREE.Vector3();
  const toEnemy = new THREE.Vector3();

  const tryAttack = (): void => {
    if (gameOver || !animator || animator.busy) return;
    animator.play('attack');
    hero.getWorldDirection(forward);
    for (const enemy of enemies) {
      if (!enemy.alive || enemy.dying) continue;
      toEnemy.set(enemy.mesh.position.x - hero.position.x, 0, enemy.mesh.position.z - hero.position.z);
      const dist = toEnemy.length();
      if (dist > ATTACK_RANGE || dist < 0.0001) continue;
      toEnemy.normalize();
      const facing = forward.x * toEnemy.x + forward.z * toEnemy.z;
      if (facing < ATTACK_CONE_COS) continue;
      // Also require the enemy to actually be near our height (don't hit the
      // guard on the platform while standing on the ground below it).
      if (Math.abs(enemy.mesh.position.y - hero.position.y) > 0.7) continue;
      enemy.hp -= 1;
      if (enemy.hp <= 0) {
        enemy.dying = true;
        enemy.animator?.play('die', { interrupt: true });
      }
    }
  };

  attackBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); tryAttack(); });

  // three.js deprecated Clock, and setAnimationLoop already hands us the
  // timestamp, so there is nothing to replace it with.
  let attackWasDown = false;
  let invincibleLeft = 0;
  const enemyDir = { x: 0, z: 0 };
  const enemySpawnOffset = new THREE.Vector3();

  let last = performance.now();
  renderer.setAnimationLoop((now: number) => {
    // Clamped: a backgrounded tab returns with a multi-second delta and
    // everything tunnels through the floor in one step.
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (!gameOver) {
      const dir = input.direction();
      character.update(dt, dir, { jump: input.jump });

      // The floor under the floor.
      if (character.position.y < RESPAWN_BELOW_Y) character.teleport(SPAWN);

      character.syncTo(hero, PLAYER_SYNC_OFFSET);
      character.faceTowards(hero, dir, dt);

      const attackDown = input.isDown('KeyJ');
      if (attackDown && !attackWasDown) tryAttack();
      attackWasDown = attackDown;
      animator?.update(character.state);

      if (invincibleLeft > 0) invincibleLeft -= dt;

      // --- Enemies: chase within a leash, bump the player, die on 0 hp. ---
      for (const enemy of enemies) {
        if (!enemy.alive) continue;

        if (enemy.dying) {
          enemy.dieTimer += dt;
          enemy.animator?.update('idle');
          if (enemy.dieTimer > 0.9) {
            enemy.alive = false;
            enemy.mesh.visible = false;
            killCount += 1;
            renderHud();
            if (killCount >= totalEnemies) endRun(true);
          }
          continue;
        }

        const pos = enemy.controller.position;
        const dx = hero.position.x - pos.x;
        const dz = hero.position.z - pos.z;
        const distToPlayer = Math.hypot(dx, dz);

        enemyDir.x = 0; enemyDir.z = 0;
        if (distToPlayer < enemy.def.detectRadius && distToPlayer > 0.001) {
          const nx = dx / distToPlayer;
          const nz = dz / distToPlayer;
          // Leash: don't move further from spawn than allowed.
          enemySpawnOffset.set(pos.x + nx * 0.1 - enemy.def.spawn.x, 0, pos.z + nz * 0.1 - enemy.def.spawn.z);
          if (enemySpawnOffset.length() <= enemy.def.leash) {
            enemyDir.x = nx; enemyDir.z = nz;
          }
        }
        enemy.controller.update(dt, enemyDir, {});
        enemy.controller.syncTo(enemy.mesh, ENEMY_SYNC_OFFSET);
        enemy.controller.faceTowards(enemy.mesh, enemyDir, dt);
        enemy.animator?.update(enemy.controller.state === 'walk' ? 'walk' : 'idle');

        if (enemy.hitCooldown > 0) enemy.hitCooldown -= dt;

        // Contact damage — full 3D distance so the platform guard can't
        // reach a player still standing on the ground below it.
        const dy = enemy.mesh.position.y - hero.position.y;
        const dist3d = Math.hypot(dx, dy, dz);
        if (dist3d < CONTACT_RANGE && enemy.hitCooldown <= 0 && invincibleLeft <= 0) {
          enemy.hitCooldown = CONTACT_COOLDOWN_SECONDS;
          invincibleLeft = HIT_INVINCIBLE_SECONDS;
          playerHP -= 1;
          renderHud();
          flashHit();
          if (playerHP <= 0) endRun(false);
        }
      }
    }

    world.update(dt); // animation + physics + follow camera
    renderer.render(world.scene, world.camera);
  });

  // Handy while developing; harmless in a published build.
  Object.assign(window as unknown as Record<string, unknown>,
    { __game: { umicat, world, character, input, animator, enemies } as unknown });
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
