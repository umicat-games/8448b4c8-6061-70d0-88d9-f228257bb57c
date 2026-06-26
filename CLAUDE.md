# Game Project

## What this is
A blank game scaffold (landscape, 1280×720). No genre defined yet — this is a fresh project.

## Features implemented
- **Bouncing red square**: A bright red 80×80 square rendered at the center of the screen, bouncing up and down continuously with a smooth sine-ease yoyo tween (amplitude ±80px, 500ms per half-cycle).

## Key implementation details
- `GameScene.ts` — the main scene. The red square is drawn with `this.add.rectangle()` at `GAME_WIDTH/2, GAME_HEIGHT/2` and animated with `this.tweens.add({ yoyo: true, repeat: -1 })`.
- `GAME_WIDTH = 1280`, `GAME_HEIGHT = 720` (from config.ts).
- The placeholder "Describe your game" text is shifted up 120px to avoid overlap with the square.

## Changed this turn
- Added a bright red bouncing square (80×80) to the center of the main scene using the Graphics rectangle API and a looping yoyo tween.
