# Umicat 3D game

A three.js game on the Umicat platform. This file is what the agent reads first.

## This game: Fox Crystal Hunt

A short collect-a-thon. The fox (`hero`) walks around an arena with three
staircased platforms (low/mid/tall — each tier is a stacked box with a
≤0.4m rise so `CharacterController3D`'s autostep climbs it without a jump,
since this game has none) and a few purely-decorative obstacles (`rock_1`,
`rock_2`, `crate_2`, plus the original `crate`, all off the paths to any
crystal).

8 crystal entities (`crystal_g1`..`g5` on the ground, `crystal_low`,
`crystal_mid`, `crystal_tall` on top of the three platforms) are plain
primitive entities with **no collider** — they're decoration, not physics
objects. `src/main.ts` picks them up itself: every frame it 3D-distance-checks
the character's position against each uncollected crystal
(`PICKUP_RADIUS = 1.0`), and on a hit sets `.visible = false`, adds it to a
`collected` Set, and re-renders the HUD score line. See `docs/design.md` /
`docs/decisions.md` for the design intent behind the numbers.

The score/win state lives in a dedicated `#score` DOM element (built
alongside the existing `#greeting` line in `main.ts`, styled in
`index.html`): "Crystals: n/8" while playing, and the same element's text
switches to "Crystals: 8/8 — Cleared!" once the last one is picked up — no
popup. Collected-crystal state is intentionally NOT saved (`umicat.saves`)
— it's current-run state like the player's position mid-round, not
progress meant to survive a reload.

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

**Rotate geometry, not objects, when orienting a primitive.** An object's
rotation is overwritten by the entity's authored transform. Getting this wrong
once left every "ground" standing upright as a wall, which renders convincingly
until the camera crosses to the other side.

**Gravity is an acceleration, not a displacement.** Feeding a character
controller a constant downward offset each frame passes a wall test and fails a
step test. `CharacterController3D` already handles this.

**UI is DOM.** There is no reason to draw a score with triangles on the web;
`index.html` has a `#hud` div for exactly this.
