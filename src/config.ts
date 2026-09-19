import { ORIENTATION_DIMENSIONS, type Orientation } from '@umicat/phaser-sdk';

// __ORIENTATION_LINE__ — overwritten by the agent-session-service scaffold
// when a new game is created (gitManager.createGameFromFork). Edit ORIENTATION
// here only if you know what you're doing — every scene was laid out for the
// orientation chosen at game creation, and switching it mid-development will
// almost certainly break layouts.
export const ORIENTATION: Orientation = 'portrait';

export const GAME_WIDTH = ORIENTATION_DIMENSIONS[ORIENTATION].width;
export const GAME_HEIGHT = ORIENTATION_DIMENSIONS[ORIENTATION].height;
