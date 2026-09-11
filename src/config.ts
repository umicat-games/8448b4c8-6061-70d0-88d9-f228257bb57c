import { ORIENTATION_DIMENSIONS, type Orientation } from '@umicat/three-sdk';

// __ORIENTATION_LINE__ — overwritten by the agent-session-service scaffold
// when a new game is created (gitManager.createGameFromFork). Edit ORIENTATION
// here only if you know what you're doing — the scene was laid out for the
// orientation chosen at game creation, and switching it mid-development will
// almost certainly break the framing.
export const ORIENTATION: Orientation = 'landscape';

/** The design canvas. A 3D game renders at the window's real size; these drive
 *  the aspect the camera is framed for, and the letterbox the host expects. */
export const GAME_WIDTH = ORIENTATION_DIMENSIONS[ORIENTATION].width;
export const GAME_HEIGHT = ORIENTATION_DIMENSIONS[ORIENTATION].height;
