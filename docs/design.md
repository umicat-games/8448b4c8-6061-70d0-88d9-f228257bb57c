# Woodland Brawl

A cheerful, chunky action arena for one player.

## Concept

A lone hero stands in a sunny forest clearing ringed by trees, rocks and a
raised lookout. A handful of critters roam the glade — clear every one of
them with melee swings to win the round. Get chipped down to nothing first
and it's game over, with an instant retry.

## Core loop

1. The round starts with a fixed roster of critters scattered around the
   clearing (one is stationed up on a raised platform, reachable only by
   climbing a short chain of jump platforms).
2. The player moves around, swings to knock critters down (each takes a
   couple of hits), and avoids their touch.
3. Getting bumped by a critter costs a heart, with a brief breather
   afterward so one clumsy moment doesn't chain into three.
4. Clearing every critter wins the round. Losing all hearts ends it.
5. Either way, a retry is one tap away, and the best "critters cleared"
   result is remembered as a house record.

## Design pillars

- **Read at a glance.** Bright grass, clear hero-vs-critter silhouettes, a
  third-person camera pulled back enough to see trouble coming.
- **A real place, not a checklist.** The clearing is dressed with real props
  — trees, rocks, crates, a spring, a little jump course — so it reads as a
  place, not a arena made of placeholder boxes.
- **Jumping matters.** At least one critter is placed somewhere you can only
  reach by climbing — the platforms aren't just scenery.
- **Cheerful, not grim.** Critters are goofy little characters, not
  monsters. A hit is a stumble and a pop, not gore.

## Controls

- Move: keyboard direction keys / on-screen thumbstick on a phone.
- Jump: Space / the on-screen jump button.
- Swing: J / the on-screen sword button (built for touch since there's no
  physical key on a phone).

## Systems

- **Health:** a handful of hearts, shown top-left. Contact with a critter
  costs one, with a short invincibility window right after so damage can't
  stack from a single stumble.
- **Critters:** each roams a home patch of the clearing and gives chase
  once the player gets close, but won't wander far from where it's posted —
  the one on the high platform stays put rather than diving off the edge,
  which is what makes climbing up to it necessary rather than optional.
  A few solid hits knock one out.
- **Win / lose:** clear every critter to win; run out of hearts to lose.
  Either way a retry is immediate — no punishing restart ritual.
- **Scoring:** critters cleared this run vs. the best run so far, kept
  between sessions as a personal best.

## Feel

- A hit lands with a visible reaction from the critter and a quick red
  flash at the screen edge when the player takes one back — cheap, instant
  feedback with no extra art.
- Climbing the platform course should feel like a small side-objective,
  not an obstacle course — a couple of confident jumps, not a precision
  test.

## Art & audio direction

- Low-poly / chunky nature props already fit the "toy diorama" look —
  lean into that rather than realism.
- Critters are small, round, bouncy silhouettes — mischievous, not scary.
- Light, upbeat game feel: a satisfying thwack on a hit, a cheerful pop on
  a knockout.
