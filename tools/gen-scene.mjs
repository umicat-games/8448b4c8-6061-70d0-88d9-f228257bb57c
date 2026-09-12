// Generate the tower-defense board.
//
// The board is DESIGN DATA, but it is regular enough that authoring it by hand
// would be forty near-identical JSON objects with a rotation nobody could
// check. A path is a polyline; which tile goes where and which way it faces
// follows from it. So the polyline is the source, this derives the rest, and
// `npm run scene` regenerates it.
//
// Everything sits on a 1-unit grid because that is exactly what the kit's
// tiles measure (1 x 0.2 x 1, verified, not assumed).
import { writeFileSync } from 'node:fs';

/** Cell centres, in world units. The path runs through these in order. */
const CORNERS = [
  [-5.5, -4.5], [3.5, -4.5], [3.5, -1.5], [-3.5, -1.5],
  [-3.5, 1.5], [3.5, 1.5], [3.5, 4.5], [-1.5, 4.5],
];

const TILE_TOP = 0.2;          // the tiles' own height
const GROUND_Y = 0;            // walkable surface

/** Expand the polyline into every cell it passes through, once each. */
function pathCells() {
  const out = [];
  const push = (x, z) => {
    const last = out[out.length - 1];
    if (!last || last[0] !== x || last[1] !== z) out.push([x, z]);
  };
  for (let i = 0; i < CORNERS.length - 1; i++) {
    const [x0, z0] = CORNERS[i], [x1, z1] = CORNERS[i + 1];
    const dx = Math.sign(x1 - x0), dz = Math.sign(z1 - z0);
    const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    for (let k = 0; k <= n; k++) push(x0 + dx * k, z0 + dz * k);
  }
  return out;
}

/** A quaternion, as the ARRAY the schema wants — an {x,y,z,w} object here is
 *  rejected at load, loudly and by name, which is the loader working. */
const yaw = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];

/** Which model and which way round, from the directions in and out of a cell.
 *
 *  The straight tile's stripe runs along Z at yaw 0 and the corner joins -Z to
 *  +X; both were read off the models rather than guessed, and the corner table
 *  is written as "coming from / going to" so it can be checked by eye. */
function tileFor(inDir, outDir) {
  const key = (d) => `${d[0]},${d[1]}`;
  if (!inDir) return { model: 'td-tile-spawn', rot: yaw(dirYaw(outDir)) };
  // The end tile's stub has to face BACK the way the path came, not onward:
  // pointing it along the direction of travel puts the join on the far edge
  // and leaves a one-cell gap of grass right before the base.
  if (!outDir) return { model: 'td-tile-end', rot: yaw(dirYaw(inDir) + Math.PI) };
  if (key(inDir) === key(outDir)) return { model: 'td-tile-straight', rot: yaw(dirYaw(inDir)) };
  // A full dirt tile at every turn. The kit's corner tile joins two specific
  // edges, and getting its yaw wrong leaves the path visibly broken at every
  // bend -- which is what happened. A tile that is path on all four edges
  // cannot be rotated wrong, and against these wide path tiles it reads as the
  // same road. Deleting a class of bug beats getting a lookup table right.
  return { model: 'td-tile-dirt', rot: yaw(0) };
}

/** Yaw that points the tile's +Z along this direction. */
function dirYaw(d) { return Math.atan2(d[0], d[1]); }

/** Unused: corners are full dirt tiles now. Kept because the next person to
 *  reach for the kit's corner tile will want the rotation table, and because
 *  it records that the table was the problem rather than the idea. */
// eslint-disable-next-line no-unused-vars
function cornerYaw(inDir, outDir) {
  const from = [-inDir[0], -inDir[1]];     // the edge we came in through
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const rot = (v) => {
      const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
      return [v[0] * c + v[1] * s, -v[0] * s + v[1] * c];
    };
    const f = rot([0, -1]), t = rot([1, 0]);
    if (f[0] === from[0] && f[1] === from[1] && t[0] === outDir[0] && t[1] === outDir[1]) return a;
    if (t[0] === from[0] && t[1] === from[1] && f[0] === outDir[0] && f[1] === outDir[1]) return a;
  }
  return 0;
}

const cells = pathCells();
const key = (c) => `${c[0]},${c[1]}`;
const onPath = new Set(cells.map(key));

const entities = [];
const add = (e) => entities.push(e);

// --- the board ---
//
// The tiles ARE the ground. Laying them ON a ground plane and sinking them
// flush buries them: the first version left 0.01 of a 0.2-thick tile showing
// and the path read as a few faint scratches. Raising them instead makes a
// 0.2 lip the character cannot climb (stepHeight is 0.17). So the whole board
// is tiles, their tops at y=0, with one collision box underneath.
add({
  id: 'ground', name: 'ground',
  // Visible only as a skirt around and below the tiles.
  primitive: { kind: 'box', size: { x: 13, y: 0.4, z: 13 }, color: '#3f6b38' },
  transform: { position: { x: 0, y: GROUND_Y - 0.4, z: 0 } },
  // Offset so the collider's TOP lands at y=0 — the tiles' own top surface.
  collider: {
    shape: { kind: 'box', halfExtents: { x: 6.5, y: 0.3, z: 6.5 } },
    body: 'fixed', offset: { x: 0, y: 0.1, z: 0 },
  },
});

// Grass, everywhere the path is not. Placed before the path so the path tiles
// are unambiguous about which cells they own.
for (let gx = -5.5; gx <= 5.5; gx += 1) {
  for (let gz = -5.5; gz <= 5.5; gz += 1) {
    if (onPath.has(key([gx, gz]))) continue;
    add({
      id: `grass_${gx}_${gz}`.replace(/[.-]/g, '_'), name: 'grass', modelAssetId: 'td-tile',
      transform: { position: { x: gx, y: GROUND_Y - TILE_TOP, z: gz } },
    });
  }
}

// Walls, so nothing walks off the edge. A world without a floor under its
// floor strands people; a world without walls does the same more slowly.
for (const [id, x, z, sx, sz] of [
  ['wall_n', 0, -6.6, 13.4, 0.4], ['wall_s', 0, 6.6, 13.4, 0.4],
  ['wall_w', -6.6, 0, 0.4, 13.4], ['wall_e', 6.6, 0, 0.4, 13.4],
]) {
  add({
    id, name: id,
    primitive: { kind: 'box', size: { x: sx, y: 1.2, z: sz }, color: '#4a4036' },
    transform: { position: { x, y: 0.4, z } },
    collider: { shape: { kind: 'box', halfExtents: { x: sx / 2, y: 0.6, z: sz / 2 } }, body: 'fixed' },
  });
}

// --- the path ---
for (let i = 0; i < cells.length; i++) {
  const c = cells[i];
  const prev = cells[i - 1], next = cells[i + 1];
  const inDir = prev ? [c[0] - prev[0], c[1] - prev[1]] : null;
  const outDir = next ? [next[0] - c[0], next[1] - c[1]] : null;
  const { model, rot } = tileFor(inDir, outDir);
  add({
    id: `path_${i}`, name: `path_${i}`, modelAssetId: model,
    // Sunk so the tiles' TOP is the walkable surface — laid ON the ground they
    // would be a 0.2 step the character cannot climb (stepHeight is 0.17).
    transform: { position: { x: c[0], y: GROUND_Y - TILE_TOP, z: c[1] }, rotation: rot },
  });
}

// --- build spots: every cell orthogonally next to the path, inside the board ---
const spots = [];
const seen = new Set();
for (const c of cells) {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = [c[0] + dx, c[1] + dz];
    if (onPath.has(key(n)) || seen.has(key(n))) continue;
    if (Math.abs(n[0]) > 5.5 || Math.abs(n[1]) > 5.5) continue;
    seen.add(key(n));
    spots.push(n);
  }
}
// ONE marker, moved to whatever the player is standing on. Drawing all 71 of
// them turned the board into a grid of orange brackets with the game somewhere
// underneath — the kit's selection ring is a cursor, not a legend.
add({
  id: 'build_marker', name: 'build_marker', modelAssetId: 'td-selection',
  transform: { position: { x: 0, y: GROUND_Y + 0.02, z: 0 } },
});

// --- scenery, only where it cannot be built on ---
const decor = [
  ['detail-tree', -5.5, 0.5], ['detail-tree', 5.5, -0.5], ['detail-tree', -5.5, 5.5],
  ['detail-rocks', 5.5, 5.5], ['detail-crystal', -5.5, -1.5], ['detail-rocks', 0.5, -5.5],
];
for (const [m, x, z] of decor) {
  if (onPath.has(key([x, z])) || seen.has(key([x, z]))) continue;
  add({
    id: `decor_${m}_${x}_${z}`.replace(/[.-]/g, '_'), name: 'decor',
    modelAssetId: `td-${m.replace('detail-', '')}`,
    transform: { position: { x, y: GROUND_Y, z } },
  });
}

// --- the hero ---
add({
  id: 'hero', name: 'hero', modelAssetId: 'hero',
  transform: { position: { x: 0, y: GROUND_Y, z: 3.5 } },
  // Declaring a starting clip is what creates the MIXER, and without a mixer
  // there is no CharacterAnimator and the hero never moves a limb — silently,
  // with the model rendering and sliding around exactly as if it were fine.
  animation: { play: 'idle', loop: true },
});

const scene = {
  schemaVersion: 1,
  id: 'main',
  name: 'Woodland Defense',
  environment: { background: '#8fc9e8' },
  gravity: { x: 0, y: -4.1692, z: 0 },
  lights: [
    { id: 'sky', kind: 'hemisphere', color: '#ffffff', groundColor: '#8fa08a', intensity: 2.0 },
    { id: 'sun', kind: 'directional', color: '#fff6e0', intensity: 2.2,
      position: { x: 4, y: 8, z: 5 }, castShadow: true },
  ],
  camera: { kind: 'follow', target: 'hero', fov: 55, offset: { x: 0, y: 5.2, z: 6.4 } },
  entities,
};

writeFileSync(new URL('../public/scenes3d/main.json', import.meta.url),
  JSON.stringify(scene, null, 2) + '\n');

// The waypoints the game walks enemies along — the same polyline, so the
// path you SEE and the path they FOLLOW cannot drift apart.
writeFileSync(new URL('../public/scenes3d/path.json', import.meta.url),
  JSON.stringify({ cells, spots }, null, 2) + '\n');

console.log(`${entities.length} entities — ${cells.length} path tiles, ${spots.length} build spots`);
