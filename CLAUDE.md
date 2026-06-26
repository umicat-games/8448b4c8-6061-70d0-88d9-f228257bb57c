# Game

**Title:** Unnamed game (scaffold)
**Genre:** Blank scaffold
**Core Mechanic:** None yet — fresh project

## Features Implemented
- Bright red square (80×80) drawn at canvas center using the Rectangle primitive
- Square bounces up and down continuously using a Sine ease yoyo tween (±60px, 500ms half-cycle)

## Key Implementation Details
- **GameScene.ts** — main scene; uses `loadWorldScene` for scene-as-data entities, then adds the square + tween programmatically after the scene loads
- **GAME_WIDTH / GAME_HEIGHT** — 1280×720 (landscape)
- Square depth: 2 (renders above background)

## This Turn
- Added a bright red bouncing square at the canvas center
