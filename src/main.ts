import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  ThreeUmicat, loadScene3D, loadModelAsset, attachToSocket, flashTint, updateTints,
  CharacterController3D, CharacterAnimator, Input3D,
  type Scene3D, type Manifest3D,
} from '@umicat/three-sdk';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

/**
 * Woodland Defense — a tower defense you can walk around in.
 *
 * The two halves have to earn each other. Towers alone is a tower defense with
 * a camera; a hero alone is the brawler this used to be. So: towers are the
 * only thing that holds a lane while you are somewhere else, and the hero is
 * the only thing that can be somewhere else in time.
 *
 * Start here: `WAVES`, `TOWERS`, and the frame loop in `start()`.
 */

const SAVE_KEY = 'td-progress';
const SPAWN = { x: 0, y: 0.5, z: 3.5 };
const RESPAWN_BELOW_Y = -5;

// --- the hero -------------------------------------------------------------
const HERO_HALF_HEIGHT = 0.2;
const HERO_RADIUS = 0.16;
const HERO_SYNC_OFFSET = -(HERO_HALF_HEIGHT + HERO_RADIUS);
const HERO_MAX_HP = 6;
const HERO_SPEED = 4.2;
const HERO_ATTACK_RANGE = 1.15;
const HERO_ATTACK_DAMAGE = 2;
const HERO_INVINCIBLE_SECONDS = 1.4;

// --- enemies --------------------------------------------------------------
/** They fly, so they float above the path rather than walking it. */
const ENEMY_FLY_HEIGHT = 0.38;
const ENEMY_MODEL_SCALE = 0.62;      // the kit's UFOs are a full tile wide
/** UFOs SHOOT. Nothing about touching one hurts you.
 *
 *  It used to be a wind-up and then a distance check, which is a hitscan with
 *  a delay — and with a 1.7-unit range and nothing visible crossing the gap it
 *  read as "walking near it costs a heart". A bullet you can see leave, cross
 *  the ground and miss is a different game, from exactly the same numbers. */
const ENEMY_SHOOT_RANGE = 3.4;
const ENEMY_SHOOT_COOLDOWN = 2.4;
/** The tell, before the shot leaves. */
const ENEMY_WINDUP_SECONDS = 0.45;
const BULLET_SPEED = 4.2;         // slower than the hero: it can be outrun
const BULLET_HIT_RADIUS = 0.38;
const BULLET_LIFE = 2.6;          // seconds before a miss gives up
/** Bullets appear a little clear of the hull so they are not drawn inside it.
 *
 *  There is NO minimum shooting distance. I added one — a UFO on top of you
 *  could not fire — to stop point-blank hits landing in ten milliseconds, which
 *  looked like damage for standing nearby. It bought a far worse problem: park
 *  the hero against a UFO and it can never hurt him, so melee became free.
 *  A fast hit you barely see beats an enemy that cannot fight back. */
const BULLET_MUZZLE = 0.15;

// --- towers ---------------------------------------------------------------
interface TowerKind {
  id: string;
  label: string;
  model: string;
  ammo: string;
  cost: number;
  range: number;
  damage: number;
  /** Seconds between shots. */
  reload: number;
  /** How fast its shot travels, in units per second. */
  shotSpeed: number;
}
const TOWERS: TowerKind[] = [
  { id: 'ballista', label: 'Ballista', model: 'td-ballista', ammo: 'td-ammo-arrow',
    cost: 25, range: 3.0, damage: 2, reload: 1.0, shotSpeed: 9 },
  { id: 'cannon', label: 'Cannon', model: 'td-cannon', ammo: 'td-ammo-ball',
    cost: 45, range: 2.2, damage: 5, reload: 2.0, shotSpeed: 7 },
];

interface Wave { count: number; hp: number; speed: number; model: string; bounty: number; }
const WAVES: Wave[] = [
  { count: 5, hp: 6, speed: 1.1, model: 'td-ufo-a', bounty: 8 },
  { count: 7, hp: 9, speed: 1.25, model: 'td-ufo-b', bounty: 10 },
  { count: 9, hp: 14, speed: 1.35, model: 'td-ufo-c', bounty: 12 },
  { count: 12, hp: 20, speed: 1.5, model: 'td-ufo-d', bounty: 16 },
];
const SPAWN_GAP = 1.1;          // seconds between enemies in a wave
const WAVE_GAP = 6;             // breathing room between waves
const START_GOLD = 60;
const BASE_LIVES = 10;

interface Enemy {
  obj: THREE.Object3D;
  hp: number;
  maxHp: number;
  speed: number;
  bounty: number;
  /** How far along the path, in cells. Fractional between waypoints. */
  t: number;
  alive: boolean;
  shootCooldown: number;
  windup: number;
}

interface Tower {
  kind: TowerKind;
  obj: THREE.Object3D;
  cell: [number, number];
  reload: number;
  level: number;
}

/** Levels 1-3. Everything about a tower scales off its level rather than being
 *  stored per upgrade, so there is one place to change how upgrading feels. */
const MAX_LEVEL = 3;
const levelDamage = (t: Tower): number => t.kind.damage * Math.pow(1.7, t.level - 1);
const levelRange = (t: Tower): number => t.kind.range * Math.pow(1.15, t.level - 1);
const levelReload = (t: Tower): number => t.kind.reload * Math.pow(0.82, t.level - 1);
const upgradeCost = (t: Tower): number => Math.round(t.kind.cost * 0.8 * t.level);

interface Shot {
  obj: THREE.Object3D;
  target: Enemy;
  damage: number;
  speed: number;
}

/** An enemy's bullet. It has a DIRECTION, not a target: once it is in the air
 *  it keeps going, which is what makes stepping aside work. */
interface Bullet {
  obj: THREE.Object3D;
  vel: THREE.Vector3;
  life: number;
}

/** Does the segment a→b pass within `r` of `c`? Closest-point-on-segment.
 *
 *  Needed because a bullet can cross a player entirely between two frames:
 *  testing only where it started and where it ended finds nothing, and the
 *  shot silently misses at exactly the range it should never miss. */
const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
function segmentHitsSphere(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, r: number): boolean {
  _ab.copy(b).sub(a);
  _ac.copy(c).sub(a);
  const len2 = _ab.lengthSq();
  const t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, _ac.dot(_ab) / len2));
  return _ac.addScaledVector(_ab, -t).lengthSq() <= r * r;
}

async function start(): Promise<void> {
  const umicat = await ThreeUmicat.init();
  await RAPIER.init();

  const [manifest, scene3d, pathData] = await Promise.all([
    fetch('scenes3d/manifest.json').then((r) => r.json() as Promise<Manifest3D>),
    fetch('scenes3d/main.json').then((r) => r.json() as Promise<Scene3D>),
    fetch('scenes3d/path.json').then((r) => r.json() as Promise<{ cells: [number, number][]; spots: [number, number][] }>),
  ]);
  const world = await loadScene3D(scene3d, manifest, { assetBase: '', rapier: RAPIER });

  const hero = world.entities.get('hero')!;
  const marker = world.entities.get('build_marker')!;
  const saved = await umicat.saves.get<{ best: number }>(SAVE_KEY);
  let bestWave = saved?.best ?? 0;

  // The path the enemies walk is the same polyline the tiles were laid from,
  // so what you see and what they follow cannot drift apart.
  const PATH = pathData.cells;
  const BUILDABLE = new Set(pathData.spots.map(([x, z]) => `${x},${z}`));

  const character = new CharacterController3D(world.world, RAPIER, {
    position: SPAWN, halfHeight: HERO_HALF_HEIGHT, radius: HERO_RADIUS,
    speed: HERO_SPEED, stepHeight: 0.17, jumpSpeed: 2.8,
  });
  const input = new Input3D({
    actions: [
      { id: 'attack', label: '⚔', keys: ['KeyJ'] },
      { id: 'build', label: '🔨', keys: ['KeyB', 'KeyE'] },
      { id: 'swap', label: '⇄', keys: ['KeyQ'] },
    ],
  });

  const heroMixer = world.mixerFor.get('hero');
  // A hero with no mixer renders and walks around perfectly while never moving
  // a limb, and nothing anywhere says so — the mixer only exists because the
  // scene entity declares a starting clip. Refuse to start instead.
  if (!heroMixer) {
    throw new Error(
      "the hero has no animation mixer — give its scene entity an `animation` " +
      "block (e.g. { play: 'idle', loop: true }); without one it cannot animate at all");
  }
  const clipMap: Record<string, string> =
    (manifest.models?.find((m) => m.id === 'hero') as { animations?: Record<string, string> } | undefined)?.animations ?? {};
  const animator = new CharacterAnimator(heroMixer, world.clips.get('hero') ?? [], clipMap);

  const heroAsset = manifest.models?.find((m) => m.id === 'hero');
  const handRight = heroAsset?.sockets?.['hand-right'];
  if (handRight) {
    const { object: sword } = await loadModelAsset(manifest, 'sword', { assetBase: '' });
    sword.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    attachToSocket(hero, handRight, sword);
  }

  // Prototypes, cloned per placement. Loading inside the build handler would
  // put a download in the middle of a button press.
  const protos = new Map<string, THREE.Object3D>();
  for (const id of [...TOWERS.map((t) => t.model), ...TOWERS.map((t) => t.ammo),
                    ...WAVES.map((w) => w.model), 'td-bullet']) {
    if (protos.has(id)) continue;
    const { object } = await loadModelAsset(manifest, id, { assetBase: '' });
    object.traverse((o) => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).castShadow = true; } });
    protos.set(id, object);
  }
  const spawnFrom = (id: string): THREE.Object3D => {
    const o = protos.get(id)!.clone(true);
    world.scene.add(o);
    return o;
  };

  // --- render ---
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const hudEl = document.getElementById('hud')!;
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

  // --- state ---
  let gold = START_GOLD;
  let lives = BASE_LIVES;
  let heroHp = HERO_MAX_HP;
  let waveIndex = 0;
  let waveTimer = 3;            // countdown to the next wave
  let spawnTimer = 0;
  let toSpawn = 0;
  let running = true;
  let won = false;
  let invincible = 1.5;
  let selected = 0;             // which tower kind the build button places
  let buildCell: [number, number] | null = null;
  /** The tower under the player's feet, if any — the thing `build` upgrades. */
  let standingOn: Tower | null = null;

  const enemies: Enemy[] = [];
  const towers: Tower[] = [];
  const shots: Shot[] = [];
  const bullets: Bullet[] = [];
  const tinted: THREE.Object3D[] = [hero];

  // --- HUD ---
  const line1 = document.createElement('div');
  const line2 = document.createElement('div');
  const line3 = document.createElement('div');
  line3.style.opacity = '0.85';
  // Gold lives in its own element because a coin flying to the counter needs a
  // rectangle to aim at, and "somewhere in that line of text" is not one.
  const livesEl = document.createElement('span');
  const goldEl = document.createElement('span');
  const waveEl = document.createElement('span');
  goldEl.style.transition = 'transform 120ms ease-out';
  line2.append(livesEl, goldEl, waveEl);
  hudEl.append(line1, line2, line3);

  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed; left: 50%; top: 38%; transform: translate(-50%, -50%);
    text-align: center; color: #fff; font: 700 26px/1.4 system-ui, sans-serif;
    text-shadow: 0 3px 10px rgba(0,0,0,.6); display: none; pointer-events: auto;
    /* ABOVE the platform's touch layer, which is a full-screen z-index 10.
       Without this the Play Again button is underneath the move zone and
       tapping it does nothing at all — see CLAUDE.md. */
    z-index: 40;
  `;
  document.body.appendChild(banner);

  const hitFlash = document.createElement('div');
  hitFlash.style.cssText = `
    position: fixed; inset: 0; pointer-events: none; background: rgba(220,30,30,0);
    transition: background 120ms ease-out;
  `;
  document.body.appendChild(hitFlash);
  const flashScreen = (): void => {
    hitFlash.style.background = 'rgba(220,30,30,0.32)';
    setTimeout(() => { hitFlash.style.background = 'rgba(220,30,30,0)'; }, 120);
  };

  /** Motes lifting off an upgraded tower — the updraft.
   *
   *  In the scene rather than in the DOM, because it has to sit in the world
   *  next to the tower it belongs to: a DOM flourish over the same pixels
   *  stops being attached to anything the moment the camera turns.
   *
   *  Deliberately cheap: a dozen unlit quads, no texture, no particle system.
   *  They rise, spiral a little, shrink and fade, and are gone in under a
   *  second — long enough to see, short enough that upgrading three towers in
   *  a row does not become a light show. */
  const updrafts: { obj: THREE.Mesh; t: number; life: number; spin: number; rise: number; r0: number; a0: number }[] = [];
  const moteGeom = new THREE.PlaneGeometry(0.09, 0.09);

  const updraft = (at: THREE.Vector3): void => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.34, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9,
        side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(at.x, at.y + 0.05, at.z);
    world.scene.add(ring);
    updrafts.push({ obj: ring, t: 0, life: 0.55, spin: 0, rise: 0.55, r0: 0, a0: 0.9 });

    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2;
      const r0 = 0.16 + Math.random() * 0.16;
      const mote = new THREE.Mesh(moteGeom, new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xfff2c4 : 0xffc94d, transparent: true, opacity: 1, depthWrite: false,
      }));
      mote.position.set(at.x + Math.cos(a0) * r0, at.y + 0.04, at.z + Math.sin(a0) * r0);
      mote.userData.cx = at.x; mote.userData.cz = at.z;
      world.scene.add(mote);
      updrafts.push({ obj: mote, t: 0, life: 0.7 + Math.random() * 0.35,
                      spin: 2.2 + Math.random() * 1.6, rise: 0.95 + Math.random() * 0.7, r0, a0 });
    }
  };

  const updateUpdrafts = (dt: number): void => {
    for (let i = updrafts.length - 1; i >= 0; i--) {
      const u = updrafts[i];
      u.t += dt;
      const k = u.t / u.life;
      if (k >= 1) {
        world.scene.remove(u.obj);
        (u.obj.material as THREE.Material).dispose();
        if (u.obj.geometry !== moteGeom) u.obj.geometry.dispose();
        updrafts.splice(i, 1);
        continue;
      }
      const mat = u.obj.material as THREE.MeshBasicMaterial;
      if (u.spin === 0) {
        // The ring: expands outward and thins away.
        const g = 1 + k * 1.5;
        u.obj.scale.setScalar(g);
        mat.opacity = u.a0 * (1 - k);
      } else {
        // A mote: rises, drifts round, and always faces the camera so a flat
        // quad never shows its edge.
        const a = u.a0 + k * u.spin;
        const r = u.r0 * (1 + k * 0.5);
        u.obj.position.y += u.rise * dt;
        u.obj.position.x = (u.obj.userData.cx as number) + Math.cos(a) * r;
        u.obj.position.z = (u.obj.userData.cz as number) + Math.sin(a) * r;
        u.obj.scale.setScalar(1 - k * 0.55);
        mat.opacity = 1 - k * k;
        u.obj.quaternion.copy(world.camera.quaternion);
      }
    }
  };

  /** A coin leaves the kill and lands on the counter.
   *
   *  Two small things carry it. It starts where the enemy DIED on screen, so
   *  the reward is attached to the thing that earned it rather than appearing
   *  in the corner; and the counter only goes up when the coin arrives, so the
   *  number and the animation are telling the same story instead of two. */
  const flyCoin = (from: THREE.Vector3, amount: number): void => {
    const p0 = from.clone().project(world.camera);
    const sx = (p0.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-p0.y * 0.5 + 0.5) * window.innerHeight;
    // Behind the camera projects to nonsense; pay out without the flourish.
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || p0.z > 1) { gold += amount; renderHud(); return; }

    const target = goldEl.getBoundingClientRect();
    const tx = target.left + target.width * 0.35;
    const ty = target.top + target.height * 0.5;

    const coin = document.createElement('div');
    coin.textContent = '💰';
    coin.style.cssText = `
      position: fixed; left: 0; top: 0; font-size: 20px; pointer-events: none;
      z-index: 35; will-change: transform, opacity;
      transform: translate(${sx - 10}px, ${sy - 10}px) scale(1);
    `;
    document.body.appendChild(coin);

    const t0 = performance.now();
    const DURATION = 520;
    const step = (t: number): void => {
      const k = Math.min(1, (t - t0) / DURATION);
      // Ease out, with a small arc — a coin that travels in a straight line
      // reads as a UI element sliding, not as something thrown.
      const e = 1 - Math.pow(1 - k, 3);
      const x = sx + (tx - sx) * e;
      const y = sy + (ty - sy) * e - Math.sin(k * Math.PI) * 46;
      coin.style.transform = `translate(${x - 10}px, ${y - 10}px) scale(${1 - k * 0.35})`;
      coin.style.opacity = String(k > 0.85 ? (1 - k) / 0.15 : 1);
      if (k < 1) { requestAnimationFrame(step); return; }
      coin.remove();
      gold += amount;
      renderHud();
      // A nudge on arrival, so the counter acknowledges being hit.
      goldEl.style.transform = 'scale(1.22)';
      setTimeout(() => { goldEl.style.transform = 'scale(1)'; }, 120);
    };
    requestAnimationFrame(step);
  };

  const renderHud = (): void => {
    line1.textContent = `${'❤️'.repeat(Math.max(heroHp, 0))}${'🤍'.repeat(Math.max(HERO_MAX_HP - heroHp, 0))}`;
    const w = Math.min(waveIndex + 1, WAVES.length);
    livesEl.textContent = `🏰 ${lives}\u2003`;
    goldEl.textContent = `💰 ${gold}`;
    waveEl.textContent = `\u2003Wave ${w}/${WAVES.length}`;
    if (standingOn) {
      const t = standingOn;
      line3.textContent = t.level >= MAX_LEVEL
        ? `${t.kind.label} Lv${t.level} — fully upgraded`
        : `🔨 upgrade ${t.kind.label} to Lv${t.level + 1} · ${upgradeCost(t)}g`;
    } else {
      const kind = TOWERS[selected];
      line3.textContent = buildCell
        ? `🔨 build ${kind.label} · ${kind.cost}g · ⇄ swap`
        : `walk to a spot beside the path to build · ⇄ ${kind.label}`;
    }
  };

  const endRun = (didWin: boolean): void => {
    running = false; won = didWin;
    // Stop taking input and take the on-screen controls away. Both halves
    // matter: the thumbstick would otherwise keep walking the character behind
    // the dialog, and its full-screen layer would swallow the taps meant for
    // the button on top of it.
    input.setEnabled(false);
    if (waveIndex + 1 > bestWave) {
      bestWave = Math.min(waveIndex + 1, WAVES.length);
      void umicat.saves.set(SAVE_KEY, { best: bestWave });
    }
    banner.style.display = 'block';
    banner.innerHTML = didWin
      ? `<div>All waves cleared</div><div style="font:600 15px/1.6 system-ui;opacity:.85">The woods are safe.</div>`
      : `<div>${lives <= 0 ? 'The base fell' : 'You were knocked out'}</div>` +
        `<div style="font:600 15px/1.6 system-ui;opacity:.85">Reached wave ${Math.min(waveIndex + 1, WAVES.length)} of ${WAVES.length}.</div>`;
    const again = document.createElement('button');
    again.textContent = 'Play Again';
    again.style.cssText = `
      margin-top: 14px; padding: 10px 20px; border-radius: 999px; border: 0;
      font: 700 15px system-ui; background: #fff; color: #222; cursor: pointer;
    `;
    again.onclick = () => location.reload();
    banner.appendChild(again);
  };

  // --- the path, as a position lookup -------------------------------------
  const posAt = (t: number, out: THREE.Vector3): THREE.Vector3 => {
    const i = Math.floor(t);
    if (i >= PATH.length - 1) {
      const last = PATH[PATH.length - 1];
      return out.set(last[0], ENEMY_FLY_HEIGHT, last[1]);
    }
    const a = PATH[i], b = PATH[i + 1], f = t - i;
    return out.set(a[0] + (b[0] - a[0]) * f, ENEMY_FLY_HEIGHT, a[1] + (b[1] - a[1]) * f);
  };

  // --- building ------------------------------------------------------------
  const cellOf = (x: number, z: number): [number, number] =>
    [Math.floor(x) + 0.5, Math.floor(z) + 0.5];
  const occupied = new Map<string, Tower>();

  /** One button, two jobs, decided by where you are standing.
   *
   *  A separate upgrade button would be a third thing on a phone screen that
   *  already has four, to do something you can only ever do in one place —
   *  standing on the tower. Where you are IS the selection in this game; that
   *  is the whole difference from a tower defense you play with a cursor. */
  const tryBuild = (): void => {
    if (!running) return;

    if (standingOn) {
      const t = standingOn;
      if (t.level >= MAX_LEVEL) { flashBanner(`${t.kind.label} is fully upgraded`); return; }
      const cost = upgradeCost(t);
      if (gold < cost) { flashBanner(`Upgrade costs ${cost}g`); return; }
      gold -= cost;
      t.level += 1;
      // Bigger, so a levelled tower is legible from across the board without
      // reading a number.
      t.obj.scale.setScalar(1 + (t.level - 1) * 0.18);
      flashTint(t.obj, { color: 0xffe28a, ms: 320 });
      updraft(t.obj.position);
      flashBanner(`${t.kind.label} → Lv${t.level}`);
      renderHud();
      return;
    }

    if (!buildCell) return;
    const kind = TOWERS[selected];
    if (gold < kind.cost) { flashBanner(`${kind.label} costs ${kind.cost}g`); return; }
    gold -= kind.cost;
    const obj = spawnFrom(kind.model);
    obj.position.set(buildCell[0], 0.02, buildCell[1]);
    const tower: Tower = { kind, obj, cell: [...buildCell] as [number, number], reload: 0, level: 1 };
    towers.push(tower);
    occupied.set(`${buildCell[0]},${buildCell[1]}`, tower);
    tinted.push(obj);
    renderHud();
  };

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; left: 50%; bottom: 22%; transform: translateX(-50%);
    color: #fff; font: 600 15px system-ui; background: rgba(0,0,0,.45);
    padding: 8px 14px; border-radius: 999px; pointer-events: none; display: none;
  `;
  document.body.appendChild(toast);
  function flashBanner(text: string): void {
    toast.textContent = text;
    toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 1400);
  }

  // --- combat --------------------------------------------------------------
  const tmp = new THREE.Vector3();
  const heroAttack = (): void => {
    if (!running || animator.busy) return;
    animator.play('attack');
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.obj.position.x - hero.position.x, e.obj.position.z - hero.position.z);
      if (d > HERO_ATTACK_RANGE) continue;
      damage(e, HERO_ATTACK_DAMAGE);
    }
  };

  const damage = (e: Enemy, amount: number): void => {
    e.hp -= amount;
    flashTint(e.obj, { color: 0xff3020, ms: 160 });
    if (e.hp > 0) return;
    e.alive = false;
    e.obj.visible = false;
    flyCoin(e.obj.position, e.bounty);
  };

  const hurtHero = (): void => {
    if (invincible > 0 || !running) return;
    invincible = HERO_INVINCIBLE_SECONDS;
    heroHp -= 1;
    flashScreen();
    flashTint(hero, { color: 0xff2a1a, ms: 220 });
    renderHud();
    if (heroHp <= 0) endRun(false);
  };

  // Left click swings. `button`/`pointerType` checked because the right button
  // is the camera and touch already has the ⚔ button — see CLAUDE.md.
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    heroAttack();
  });

  renderHud();

  let last = performance.now();
  const dir = new THREE.Vector3();
  const prevPos = new THREE.Vector3();
  const heroHit = new THREE.Vector3();
  renderer.setAnimationLoop((now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    const turn = input.look();
    if (turn.x || turn.y) world.orbit(turn.x, turn.y);

    if (running) {
      const move = input.direction(world.cameraYaw);
      character.update(dt, move, { jump: input.jump });
      if (character.position.y < RESPAWN_BELOW_Y) character.teleport(SPAWN);
      character.syncTo(hero, HERO_SYNC_OFFSET);
      character.faceTowards(hero, move, dt);

      if (input.consume('attack')) heroAttack();
      if (input.consume('swap')) { selected = (selected + 1) % TOWERS.length; renderHud(); }
      if (input.consume('build')) tryBuild();
      animator.update(character.state);
      if (invincible > 0) invincible -= dt;

      // Where the player could build right now. Recomputed every frame because
      // it is a function of where they are standing — a cached answer is one
      // that is wrong the moment they walk.
      const cell = cellOf(hero.position.x, hero.position.z);
      const key = `${cell[0]},${cell[1]}`;
      const here = occupied.get(key) ?? null;
      const canBuild = !here && BUILDABLE.has(key);
      const before = `${standingOn ? standingOn.cell.join(',') : ''}|${buildCell ? key : ''}`;
      standingOn = here;
      buildCell = canBuild ? cell : null;
      // The ring marks anywhere the button will DO something, built or not —
      // otherwise standing on your own tower looks like standing on grass.
      marker.visible = canBuild || !!here;
      if (marker.visible) marker.position.set(cell[0], 0.03, cell[1]);
      if (before !== `${standingOn ? standingOn.cell.join(',') : ''}|${buildCell ? key : ''}`) renderHud();

      // --- waves ---
      if (toSpawn > 0) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnTimer = SPAWN_GAP;
          toSpawn -= 1;
          const w = WAVES[waveIndex];
          const obj = spawnFrom(w.model);
          obj.scale.setScalar(ENEMY_MODEL_SCALE);
          const e: Enemy = {
            obj, hp: w.hp, maxHp: w.hp, speed: w.speed, bounty: w.bounty,
            t: 0, alive: true, shootCooldown: 1, windup: 0,
          };
          posAt(0, obj.position);
          enemies.push(e);
          tinted.push(obj);
        }
      } else if (enemies.every((e) => !e.alive)) {
        waveTimer -= dt;
        if (waveTimer <= 0) {
          if (waveIndex >= WAVES.length) { endRun(true); }
          else {
            toSpawn = WAVES[waveIndex].count;
            spawnTimer = 0;
            waveTimer = WAVE_GAP;
            renderHud();
          }
        }
      }

      // --- enemies walk the path ---
      for (const e of enemies) {
        if (!e.alive) continue;
        e.t += (e.speed * dt);
        if (e.t >= PATH.length - 1) {
          // It got through. That is what the towers were for.
          e.alive = false;
          e.obj.visible = false;
          lives -= 1;
          flashScreen();
          renderHud();
          if (lives <= 0) { endRun(false); break; }
          continue;
        }
        posAt(e.t, e.obj.position);
        e.obj.rotation.y += dt * 1.6;   // UFOs spin; it reads as "alive"

        // Shooting the hero. Same shape as the tower's: a wind-up you can see
        // and walk out of, rather than damage for standing nearby.
        const dHero = Math.hypot(e.obj.position.x - hero.position.x, e.obj.position.z - hero.position.z);
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) {
            // Fire at where the hero IS, and then forget about them. A bullet
            // that steers is a slower contact hit wearing a costume.
            const v = new THREE.Vector3(
              hero.position.x - e.obj.position.x,
              (hero.position.y + 0.3) - e.obj.position.y,
              hero.position.z - e.obj.position.z,
            );
            if (v.lengthSq() < 1e-6) v.set(0, 0, 1);
            v.normalize();
            const bullet = spawnFrom('td-bullet');
            // Out in front, not from inside the hull. Spawned at the centre it
            // could already be past the player, and at close range it crossed
            // the gap faster than a frame — invisible damage for being nearby,
            // which is the thing this was supposed to replace.
            bullet.position.copy(e.obj.position).addScaledVector(v, BULLET_MUZZLE);
            bullet.lookAt(bullet.position.clone().add(v));
            bullets.push({ obj: bullet, vel: v.multiplyScalar(BULLET_SPEED), life: BULLET_LIFE });
          }
        } else if (e.shootCooldown > 0) {
          e.shootCooldown -= dt;
        } else if (dHero < ENEMY_SHOOT_RANGE) {
          e.windup = ENEMY_WINDUP_SECONDS;
          e.shootCooldown = ENEMY_SHOOT_COOLDOWN;
          flashTint(e.obj, { color: 0xffd050, ms: ENEMY_WINDUP_SECONDS * 1000 });
        }
      }

      // --- towers shoot ---
      for (const t of towers) {
        t.reload -= dt;
        // Nearest FIRST, not nearest overall: in a tower defense the one
        // closest to the end is the one about to cost you a life.
        let target: Enemy | null = null;
        for (const e of enemies) {
          if (!e.alive) continue;
          const d = Math.hypot(e.obj.position.x - t.cell[0], e.obj.position.z - t.cell[1]);
          if (d > levelRange(t)) continue;
          if (!target || e.t > target.t) target = e;
        }
        if (target) {
          // Face it even while reloading — a turret tracking its target is how
          // a player reads "this one is covering that corner".
          t.obj.rotation.y = Math.atan2(
            target.obj.position.x - t.cell[0], target.obj.position.z - t.cell[1]);
        }
        if (target && t.reload <= 0) {
          t.reload = levelReload(t);
          const shot = spawnFrom(t.kind.ammo);
          shot.position.set(t.cell[0], 0.35, t.cell[1]);
          shots.push({ obj: shot, target, damage: levelDamage(t), speed: t.kind.shotSpeed });
        }
      }

      // --- enemy bullets fly ---
      for (let i = bullets.length - 1; i >= 0; i--) {
        const bu = bullets[i];
        bu.life -= dt;
        prevPos.copy(bu.obj.position);
        bu.obj.position.addScaledVector(bu.vel, dt);
        // Swept, not sampled. A bullet fired from touching distance covers the
        // whole gap inside one frame, and a point test at each end would find
        // it on neither side of the player it just went through.
        const hit = segmentHitsSphere(prevPos, bu.obj.position,
          heroHit.set(hero.position.x, hero.position.y + 0.3, hero.position.z), BULLET_HIT_RADIUS);
        if (hit || bu.life <= 0 || Math.abs(bu.obj.position.x) > 7 || Math.abs(bu.obj.position.z) > 7) {
          if (hit) hurtHero();
          world.scene.remove(bu.obj);
          bullets.splice(i, 1);
        }
      }

      // --- tower shots fly ---
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        if (!s.target.alive) { world.scene.remove(s.obj); shots.splice(i, 1); continue; }
        dir.copy(s.target.obj.position).sub(s.obj.position);
        const dist = dir.length();
        if (dist < 0.25) {
          damage(s.target, s.damage);
          world.scene.remove(s.obj);
          shots.splice(i, 1);
          continue;
        }
        dir.normalize();
        s.obj.position.addScaledVector(dir, Math.min(dist, s.speed * dt));
        s.obj.lookAt(s.target.obj.position);
      }
    }

    updateUpdrafts(dt);
    updateTints(tinted);
    world.update(dt);
    renderer.render(world.scene, world.camera);
  });

  Object.assign(window as unknown as Record<string, unknown>, {
    __game: {
      umicat, world, character, input, animator,
      get enemies() { return enemies; },
      get towers() { return towers; },
      get shots() { return shots; },
      get bullets() { return bullets; },
      get updrafts() { return updrafts; },
      state: () => ({ gold, lives, heroHp, waveIndex, running, won, buildCell, selected,
                      standingOn: standingOn ? { kind: standingOn.kind.id, level: standingOn.level } : null,
                      towers: towers.map((t) => ({ kind: t.kind.id, level: t.level, cell: t.cell })) }),
      build: () => tryBuild(),
      locomotion: () => animator.action || character.state,
    } as unknown,
  });
  void tmp;
}

void start().catch((err) => {
  const hud = document.getElementById('hud');
  if (hud) hud.textContent = `Failed to start: ${String(err)}`;
  console.error('[umicat] game failed to start', err);
});

void GAME_WIDTH; void GAME_HEIGHT;
