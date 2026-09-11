# Woodland Brawl

A cheerful, chunky forest brawler for two players sharing one keyboard.

## Concept

Two heroes stand in a sunny forest clearing. Waves of critters shuffle out of
the treeline and close in — the players smack them down together with melee
swings before they're overrun. Clear a wave, catch your breath for a moment,
then the next (bigger) wave comes. Simple, readable, couch-friendly chaos.

## Core loop

1. A wave of critters spawns at the edge of the clearing and shambles toward
   the players.
2. Players move and swing to knock critters out; each takes a couple of hits.
3. Defeated critters drop a coin or a heart.
4. Once the wave is cleared, a short breather, then the next wave starts —
   more critters, a little faster.
5. If a critter reaches a player, it chips their health. Losing all health
   knocks that player down; when both are down, the run ends.
6. Score (critters cleared) is compared against a shared best run.

There's no separate "win" screen — it's an endless survive-as-long-as-you-can
loop, scored by how many waves you clear together.

## Design pillars

- **Read at a glance.** Bright grass, clear player-vs-critter silhouettes, a
  wide fixed camera that always shows the whole clearing — never a fight you
  can't see coming.
- **Couch-friendly.** Built for two people, one keyboard, sitting side by
  side. No menus to fumble through mid-fight.
- **Cheerful, not grim.** Critters are goofy and bouncy, not scary. Getting
  hit is a stumble, not gore. Defeats are a satisfying little pop.
- **Escalation, not punishment.** Waves ramp gradually. The tension is "can
  we keep this up," not "one mistake and it's over."

## Players & controls

Both heroes look the same but are tagged with a small colored marker (e.g. a
floating ring) over their heads — blue for Player 1, orange for Player 2 — so
it's always clear who's who on screen.

- **Player 1:** WASD to move, Space to jump, F to swing.
- **Player 2:** Arrow keys to move, Right Shift to jump, Right Ctrl to swing.

## Systems

- **Health:** each player has a small number of hearts. Contact with a
  critter costs one heart, with a brief invincible flinch afterward so damage
  can't stack instantly. Zero hearts knocks that player down (they can be
  revived by their partner clearing the current wave, keeping co-op play
  going instead of ending the run on one mistake).
- **Waves:** a wave is a count of critters and a spawn pace. Both increase
  gradually as waves clear, so the game gets harder without a hard difficulty
  cliff.
- **Critters:** simple forest creatures that walk toward the nearest player
  and bump them. They take a small number of hits to defeat and react
  visibly when struck (a knockback/squash), so hits feel like they land.
  A defeated critter leaves behind a coin (score) or occasionally a heart
  (a little healing back for whoever picks it up).
- **Scoring:** critters cleared (and waves survived) add up to a run score.
  The best combined score is remembered between sessions as a shared house
  record for the couch.

## Feel

- Forest clearing bathed in warm daylight, ringed by trees and rocks so the
  play space reads as an "arena" without walls looking artificial.
- A hit lands with a snap of camera nudge and a knockback pop, not just a
  number disappearing.
- Getting knocked down is a stumble-and-sit animation beat, not a fail state
  — it should feel recoverable, because it is.

## Art & audio direction

- Low-poly / chunky nature props (trees, rocks, flowers) already fit the
  scaffold's kit — lean into that "toy diorama" look rather than realism.
- Critters are small, round, bouncy silhouettes — friendly-looking even as
  the antagonist.
- Light, upbeat game feel: a satisfying "thwack" on hits, a cheerful pop on
  defeat, a small fanfare on clearing a wave.
