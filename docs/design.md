# Fox Crystal Hunt

A small 3D collect-a-thon: a fox explores a cluttered little arena, gathers
scattered crystals, and clears the level once every crystal is found.

## Core loop

1. Player walks the fox around the arena.
2. Walking into a crystal picks it up automatically and adds to the score.
3. Some crystals sit on raised platforms — the player has to find a way up
   (walk up a ramp/step, or hop between platforms) to reach them.
4. Once every crystal is collected, the score readout shows a "cleared"
   state. No further goal after that — it's a short, complete round.

## Design pillars

- **Read at a glance.** The score is always visible; the player should never
  wonder how many crystals are left.
- **A little vertical variety, no punishing platforming.** Platforms of a
  few different heights make the space feel less flat, but nothing requires
  precise jumps — reaching a crystal should always be doable by walking a
  path up, not by frame-perfect timing.
- **Clutter with intent.** Obstacles (crates, rocks, etc.) exist to make the
  arena feel lived-in and to gently obscure sightlines to a couple of the
  crystals, encouraging exploration — they never block the only path
  through an area.

## Systems

**Crystals**
- 8 crystals placed around the arena: a mix of ground-level crystals and
  crystals sitting on top of platforms.
- Picking one up is proximity-based (no button) — the fox walking near/into
  it collects it.
- Each crystal collected increments the score by 1.

**Score / win state**
- A small always-on readout in a screen corner: "Crystals: n / 8".
- When n reaches 8, that same readout switches to a "Cleared!" message —
  no popup, no modal, the game just keeps running underneath it.

**Level layout**
- A handful of platforms at a few different heights (short step-up ledges,
  one taller block) — climbable by walking, not jumping.
- A few decorative obstacles (crates/rocks) scattered around for visual
  clutter and mild sightline-blocking; none of them fully block a path.

## Feel & art direction

- Crystals are small, bright, saturated gem shapes that stand out from the
  ground/platform palette — easy to spot from a distance.
- Platforms and obstacles use warm, earthy tones consistent with the
  existing arena so the crystals are the visual accent, not the scenery.
- No idle bobbing/spinning on the crystals — they read as valuable through
  color and shape, not motion.
