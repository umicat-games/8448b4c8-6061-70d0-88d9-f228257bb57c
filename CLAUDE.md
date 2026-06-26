# Game Overview

**Title:** Unnamed Game  
**Genre:** Prototype / Sandbox  
**Core Mechanic:** Currently a blank canvas with a bouncing red square in the center.

## Features Implemented

- **Bouncing red square**: A bright red 100×100 square centered at (640, 360) that bounces up and down continuously using a sine-ease tween (80px amplitude, 500ms period).
- Default empty-scene placeholder text ("Describe your game in the chat!") when no entities are defined.

## Key Implementation Details

- **GameScene.ts**: Loads world scene entities via `loadWorldScene`; red square added via `this.add.rectangle` with a yoyo tween for the bounce animation.
- Canvas size: 1280×720 (GAME_WIDTH × GAME_HEIGHT from config.ts).
- Square depth: 2 (above background).

## Changes This Turn

- Added a bright red `this.add.rectangle` (100×100, color `0xff2222`) centered at `GAME_WIDTH/2, GAME_HEIGHT/2`.
- Added a `this.tweens.add` with `yoyo: true, repeat: -1` on the square's `y` property (Sine.easeInOut, 80px up, 500ms).
