# Decisions

## 2026-09-11 — Single-player arena brawler, not co-op

Started drafting a two-player couch co-op "endless waves" version, but the
actual ask was a single-player round with a fixed roster of critters, a
clear win (all critters down) / lose (out of hearts) condition, and jump
platforms that gate one critter behind actually climbing. Rewrote the design
around that before building: one hero, five critters, one of them posted on
a reachable-only-by-jumping platform. Endless waves and a second player are
easy to add later if wanted, but weren't asked for.

## 2026-09-11 — Rebalanced after a real playtest: too hard to survive the opening

A playtest died in 5 seconds standing still and got zero kills before going
down while actively fighting. The problem wasn't the concept, it was pacing
and feedback: every critter noticed the player at once in the opening
seconds, a landed hit had no weight (no pushback, no recovery time for
either side), and swinging required facing an enemy square-on even though
turning to face only happens while moving — so a swing that looked like it
connected often didn't count.

Rejected: making the player tankier as the only fix (more hearts alone
doesn't fix "the fight never lets you breathe"). Instead: critters now wake
up staggered rather than all at once, a landed hit knocks the target back
and stuns it briefly (so winning a trade actually buys space), and a swing
is a forgiving swipe around the player rather than a narrow forward-facing
poke. Verified afterward with real numbers rather than by eye: standing
completely still and doing nothing now survives ~18s (was ~5s), and an
always-attacking run clears the whole roster in well under a minute.
