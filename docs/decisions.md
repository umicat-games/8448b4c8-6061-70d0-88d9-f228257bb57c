# Decisions log

## 2026-09-11 — Turned the scaffold into a crystal-collecting round

**Decision:** The core loop is: walk the fox around, collect 8 scattered
crystals by proximity (no button), see a live "Crystals: n/8" readout, and
get a "Cleared!" state in that same readout once all 8 are found.

**Why:** The project had no defined mechanic yet — just a ground, a wall and
a floating test crate. The user wanted a complete, small, readable goal
rather than an open sandbox.

**Also decided (from the user's picks):**
- 8 crystals, spread widely (5 on the ground, 3 on raised platforms) rather
  than a quick 3-crystal round — favors more exploration of the arena.
- Platforms/obstacles are climbed by walking (staircased height, ≤0.4m per
  rise) — no jump exists in this game, so nothing requires one.
- Obstacles (rocks/crates) are pure clutter — placed off the paths to the
  crystals, never gating them.
- The "cleared" state is shown ONLY in the existing score readout — no
  popup/modal — to keep the HUD minimal.

**Rejected:** A 3-crystal quick round (too little to explore) and a popup
"Level Complete" modal (adds UI weight the user didn't want).
