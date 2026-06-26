# Game Overview
- **Title**: Untitled Game
- **Genre**: Sandbox / Demo
- **Core mechanic**: N/A — starter scaffold

## Features Implemented
- Bright red square (100×100) centered on screen, bouncing up and down with a smooth sine ease tween

## Key Implementation Details
- **GameScene.ts**: Draws the red square with `this.add.rectangle` and animates it with a yoyo tween (500ms, Sine.easeInOut, repeat -1, 80px travel)
- Scene-as-data architecture in place (`loadWorldScene`); the square is added directly in `create()` after world entities load

## Last Turn Changes
- Added a bright red 100×100 square at the canvas center with a continuous vertical bounce tween
