# Woodland Brawl

A single-player action arena. One hero, five kit critters roaming a forest
clearing, melee combat, a jump-platform course that gates one critter behind
actually climbing. Win by clearing every critter; lose by running out of
hearts; retry is instant. See `docs/design.md` for the full design intent.

## Current implementation (this turn)

- **Manifest** (`public/scenes3d/manifest.json`): added `platform-fortified`,
  and five enemy model ids (`enemy-oobi/oodi/ooli/oopi/oozi`, each pointing at
  a distinct `kit/platformer/character-*.glb`) with an animation map of
  `idle`/`walk`/`die`/`attack` (`attack-melee-right`) — verified these clip
  names exist on all five models before mapping them (never guessed).
- **Scene** (`public/scenes3d/main.json`): added a 3-step floating platform
  course (`step_low` → `step_mid` → `step_top`, using `platform` /
  `platform-fortified`, each with a box collider sized from the model's real
  bounding box) leading to `enemy_oozi`, posted on `step_top`. Four more
  enemy entities scattered around the clearing at ground level. Added fog and
  widened/raised the follow camera offset so incoming critters are visible.
  No collider is authored on enemy/hero entities in the scene — their
  physics bodies are built in code via `CharacterController3D`, matching the
  existing `hero` pattern.
- **Game logic** (`src/main.ts`):
  - Player: unchanged control scheme (WASD move, Space jump, J attack) plus
    an on-screen sword button (`#hud`-adjacent, mounted to `<body>`) so the
    swing works on touch — `Input3D` only covers move/jump on phones, not a
    game-specific action.
  - Enemies: one `CharacterController3D` + `CharacterAnimator` per critter
    (same classes the player uses), driven by a small chase-with-a-leash AI
    in the frame loop — moves toward the player when within `detectRadius`,
    but a per-enemy `leash` distance from its spawn point clamps the
    direction to zero once exceeded. The platform guard (`enemy_oozi`) has a
    leash of `0.35`, short enough it never nears the platform's edge, so
    reaching it requires the player to actually climb the platform course.
  - Combat: `tryAttack()` does a cone check (dot product against
    `hero.getWorldDirection()`) within `ATTACK_RANGE`, plus a vertical
    guard so you can't hit the platform guard from the ground below it.
    Contact damage uses full 3D distance for the same reason, with a
    per-enemy cooldown and a global player invincibility window so one
    stumble doesn't chain-hit.
  - HUD: heart row + kill counter + best-score line as `#hud` children
    (never `hud.textContent =`), a win/lose overlay with a Play Again button
    (`location.reload()` — simplest reliable reset for a Rapier world), and a
    red edge-flash on taking a hit for free feedback.
  - Save: `umicat.saves` key `highScore` — critters cleared in the best run,
    written once at the end of a run (not every frame).

## Where things are

| | |
|---|---|
| `src/main.ts` | the whole game loop — start here |
| `src/config.ts` | the design canvas + `ORIENTATION` (set at game creation; do not change it) |
| `public/scenes3d/main.json` | **the scene** — entities, lights, colliders, camera |
| `public/scenes3d/manifest.json` | models, their import scale, and their **animation map** |
| `public/assets/` | `.glb` models, textures, audio |

## The two halves, and why the split matters

**Platform** — `umicat.saves`, `umicat.gameData`, `umicat.rooms`, `umicat.ai`,
`umicat.voice`, `umicat.dialogue`, `umicat.user`. Identical to what a 2D Umicat
game gets, because it is the same package underneath
(`@umicat/platform-sdk`). None of it knows anything is being drawn.

**Engine** — `loadScene3D`, `CharacterController3D`, `Input3D`, three.js and
Rapier. This is the part that differs from a 2D game.

When something goes wrong, knowing which half you are in usually names the bug.

## The scene format

`scenes3d/main.json` is **design data**: what the game looks like before anyone
plays it. No save is loaded when it is read. Rules that are decisions, not
accidents:

- **Rotation is a quaternion** `[x, y, z, w]`, never Euler angles.
- **Ids are authored and stable.** Saves and code refer to entities by id.
- **Transforms are local to `parent`.** World transforms are derived.
- **Colliders are explicit.** Never use a render mesh as a dynamic collider —
  that is the classic way to make a game that is correct and unplayably slow.
- **Animation clips are mapped by meaning** in the manifest
  (`{ "walk": "Walk" }`), never guessed from the clip's name.

`loadScene3D` refuses duplicate ids, dangling parents, entities that would draw
nothing, and trimesh colliders on dynamic bodies — at load, because every one of
them otherwise shows up as a blank screen an hour later.

## Building

```bash
npm run dev      # local dev server
npm run build    # what the platform runs
```

## Things that will bite

**A `SkinnedMesh`'s bounding sphere comes from the bind pose** and does not
follow its bones, so three.js culls a character against a stale volume and it
vanishes the moment it moves. `loadScene3D` already sets `frustumCulled = false`
on skinned meshes; if you add a character by hand, do the same.

**An action is a one-shot, not a state.** The character ships 32 clips —
`attack`, `kick`, `pick-up`, `interact`, `holding-*` (including shooting),
`die`, `emote-yes/no` — and `CharacterAnimator.play('attack')` runs one once and
hands control back. Gate on `animator.busy` so one press is one swing, and use
an edge check if you do not want holding the key to chain them. Locomotion keeps
following `character.state` underneath.

**Use the prop kit before you draw scenery out of boxes.** `public/kit/` ships
86 real models with a catalogue at `public/kit/index.json`. A coloured box named
`crystal` is still a box, and a scene of them reads as a prototype.

**The world's unit is Kenney's, not the metre.** A character is 0.72 units tall,
so ~4,700 CC0 props drop in at `importScale: 1`. Anything length-shaped you add —
sizes, positions, collider extents, camera offsets, speeds, **and gravity** —
lives in that unit. See ASSETS.md.

**Rotate geometry, not objects, when orienting a primitive.** An object's
rotation is overwritten by the entity's authored transform. Getting this wrong
once left every "ground" standing upright as a wall, which renders convincingly
until the camera crosses to the other side.

**Jump and the on-screen controls belong to the SDK, not to your game.**
`update(dt, dir, { jump })` takes the button's current state; coyote time,
input buffering and the release-cut live in `CharacterController3D` because
every 3D game shares this character (ADR-034). `Input3D` adds a thumbstick and
jump button on touch devices and merges them into the same `direction()` and
`jump`, so nothing here branches on input source.

**Never write `hud.textContent`.** It wipes every child the HUD has. Append a
child element instead. The platform's touch controls mount to `<body>` for
exactly this reason, but anything YOU put in the HUD is still yours to lose.

**Animate from `character.state`, not from input.** `idle`/`walk`/`jump`/`fall`
describe what the character is doing; a clip chosen from the key that is held
leaves it walking in mid-air.

**Gravity is an acceleration, not a displacement.** Feeding a character
controller a constant downward offset each frame passes a wall test and fails a
step test. `CharacterController3D` already handles this.

**A character that moves is not a character that is animating.** The scene
starts one clip and the SDK exposes the mixer, but nothing switches it — so
without the idle/walk swap in `main.ts` the character slides around playing its
idle animation. That reads as "no animation", and it survives a test that only
asks whether bones moved, because idle moves bones too. Cross-fade between
clips; a cut looks like teleporting between poses. Under ADR-034 this belongs
in the platform eventually — once every game shares one character, which clip
plays when you move is the character's behaviour, not the game's.

**UI is DOM.** There is no reason to draw a score with triangles on the web;
`index.html` has a `#hud` div for exactly this.
