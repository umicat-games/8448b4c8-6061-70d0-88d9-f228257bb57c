import Phaser from 'phaser';
import { loadWorldScene, getEntityRegistry } from '@umicat/phaser-sdk';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

/**
 * GameScene — generic loader for world scene files (`scenes/world/*.json`).
 *
 * Takes a `sceneId` via init data and asks the SDK to spawn its entities,
 * configure the camera, and register them. Behavior code lives in
 * `update()` and per-role helpers; it looks entities up via the entity
 * registry rather than holding direct references to objects created here.
 *
 * Example (the agent writes this kind of thing in update or pointer
 * handlers, NOT in create — entities come from the scene file now):
 *
 * ```ts
 * const player = getEntityRegistry(this)?.byRole('player')[0];
 * if (player && this.input.keyboard?.checkDown(this.cursors.up)) {
 *   (player as Phaser.GameObjects.Sprite).y -= 4;
 * }
 * ```
 */
export class GameScene extends Phaser.Scene {
  private sceneId!: string;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { sceneId: string }): void {
    this.sceneId = data.sceneId;
  }

  async create(): Promise<void> {
    const { sceneFile } = await loadWorldScene(this, this.sceneId);

    if (sceneFile.entities.length === 0) {
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, 'Describe your game\nin the chat!', {
          fontSize: '28px',
          color: '#ffffff',
          align: 'center',
        })
        .setOrigin(0.5);
    }

    // Bright red bouncing square in the center
    const squareSize = 80;
    const square = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, squareSize, squareSize, 0xff2222);
    square.setDepth(2);

    this.tweens.add({
      targets: square,
      y: GAME_HEIGHT / 2 - 80,
      duration: 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Behavior wiring goes below this line. Look entities up via
    //   const player = getEntityRegistry(this)?.byRole('player')[0];
    // See SDK-GUIDE.md and `scenes/manifest.json`.
  }

  update(_time: number, _delta: number): void {
    // Agent-written game-loop logic. Empty by default.
  }
}
