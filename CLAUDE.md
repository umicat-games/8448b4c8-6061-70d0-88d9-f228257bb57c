# Game Project

## What this is
A blank Phaser 3 scaffold with a scene-as-data architecture. No gameplay mechanics have been defined yet.

## Features currently implemented
- **Bouncing red square**: A bright red 80×80 square centered at (640, 360) that bounces up and down using a looping sine-ease tween (±80px, 500ms per direction).

## Key implementation details
- `GameScene.ts`: Main scene. Uses `loadWorldScene` from the SDK to load `scenes/world/main.json`. The red square is created programmatically in `create()` using `this.add.rectangle` and animated with `this.tweens.add` (yoyo: true, repeat: -1).
- `BootScene.ts`: Asset loading (unchanged).
- `src/config.ts`: GAME_WIDTH = 1280, GAME_HEIGHT = 720.

## Changes this turn
- Added a bright red bouncing square to the center of the main scene via `this.add.rectangle` and a looping yoyo tween.
