/*
 * Flat isometric illustration: a vault and server block on a platform, a stack of documents on
 * top, a lock and a shield in front. All geometry goes through one projection, so every edge
 * sits at exactly 30 degrees. Details on a face are drawn flat in that face's own coordinates
 * and mapped onto it with an SVG matrix, which keeps them in perfect perspective.
 */

const COS30 = Math.cos(Math.PI / 6);
const UNIT = 26;
const ORIGIN_X = 280;
const ORIGIN_Y = 92;

// Solid tints of the brand colours only. Light comes from the upper left:
// tops are lightest, left faces mid, right faces darkest.
const C = {
  white: "#FFFFFF",
  lav100: "#F3F2FD",
  lav200: "#E7E5F5",
  lav300: "#D9D6F0",
  lav400: "#C4C0E6",
  ind100: "#E4E3FB",
  ind200: "#C9C7F7",
  ind300: "#A7A4F1",
  ind400: "#827EEB",
  ind500: "#605BE5",
  ind600: "#4C47CF",
  ind700: "#3A35A8",
  plum300: "#A898AD",
  plum700: "#5A3961",
  plum800: "#3D1A45",
  plum900: "#2A0831",
};

/** Scene coordinates (x to the lower right, y to the lower left, z up) to screen pixels. */
function pt(x, y, z) {
  return [ORIGIN_X + (x - y) * COS30 * UNIT, ORIGIN_Y + (x + y) * 0.5 * UNIT - z * UNIT];
}

function points(...corners) {
  return corners.map((corner) => pt(...corner).map((n) => n.toFixed(2)).join(",")).join(" ");
}

function matrix(a, b, c, d, [e, f]) {
  return `matrix(${a.toFixed(4)} ${b.toFixed(4)} ${c.toFixed(4)} ${d.toFixed(4)} ${e.toFixed(2)} ${f.toFixed(2)})`;
}

/** Face facing +y (lower left on screen). Local u runs along +x, v runs up. */
const leftPlane = (x, y, z) => matrix(COS30 * UNIT, 0.5 * UNIT, 0, -UNIT, pt(x, y, z));
/** Face facing +x (lower right on screen). Local u runs along -y (left to right on screen), v runs up. */
const rightPlane = (x, y, z) => matrix(COS30 * UNIT, -0.5 * UNIT, 0, -UNIT, pt(x, y, z));
/** Horizontal face. Local u runs along +x, v along +y. */
const topPlane = (x, y, z) => matrix(COS30 * UNIT, 0.5 * UNIT, -COS30 * UNIT, 0.5 * UNIT, pt(x, y, z));

/** A box with its three visible faces. Each face is outlined in its own colour to close hairline seams. */
function Box({ x, y, z, w, d, h, top, left, right }) {
  const face = (fill, corners) => <polygon points={points(...corners)} fill={fill} stroke={fill} strokeWidth="0.6" strokeLinejoin="round" />;
  return (
    <g>
      {face(left, [
        [x, y + d, z + h],
        [x + w, y + d, z + h],
        [x + w, y + d, z],
        [x, y + d, z],
      ])}
      {face(right, [
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x + w, y + d, z],
        [x + w, y, z],
      ])}
      {face(top, [
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ])}
    </g>
  );
}

/** A flat solid shadow on a horizontal surface: the footprint pushed away from the light. */
function Shadow({ x, y, z, w, d, dx = 1, dy = 0.5, fill = C.lav200 }) {
  return (
    <polygon
      points={points([x + dx, y + dy, z], [x + w + dx, y + dy, z], [x + w + dx, y + d + dy, z], [x + dx, y + d + dy, z])}
      fill={fill}
    />
  );
}

const PLATFORM = { x: 0, y: 0, z: 0, w: 12, d: 12, h: 0.45 };
const FLOOR = PLATFORM.h;

function Platform() {
  const lines = [2, 4, 6, 8, 10];
  return (
    <g>
      <Shadow x={0} y={0} z={0} w={12} d={12} dx={0.7} dy={0.7} fill={C.lav200} />
      <Box {...PLATFORM} top={C.white} left={C.lav200} right={C.lav300} />
      <g transform={topPlane(0, 0, FLOOR)} stroke={C.lav100} strokeWidth="1" vectorEffect="non-scaling-stroke">
        {lines.map((n) => (
          <g key={n}>
            <line x1={n} y1={0.3} x2={n} y2={11.7} vectorEffect="non-scaling-stroke" />
            <line x1={0.3} y1={n} x2={11.7} y2={n} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </g>
    </g>
  );
}

const BLOCK = { x: 3, y: 2.5, w: 5.5, d: 5.5, z: FLOOR, h: 4.35 };
const BLOCK_TOP = BLOCK.z + BLOCK.h;
const RACK_UNITS = 3;

/** The round vault door on the block's left face, with a four spoke wheel. */
function VaultDoor() {
  const cx = BLOCK.w / 2;
  const cy = BLOCK.h / 2;
  const spokes = [45, 135, 225, 315];
  const spokeLength = 0.72;
  return (
    <g transform={leftPlane(BLOCK.x, BLOCK.y + BLOCK.d, BLOCK.z)}>
      <circle cx={cx} cy={cy} r={1.62} fill={C.ind600} />
      <circle cx={cx} cy={cy} r={1.36} fill={C.ind400} />
      <circle cx={cx} cy={cy} r={0.98} fill="none" stroke={C.ind300} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {spokes.map((angle) => {
        const radians = (angle * Math.PI) / 180;
        const end = [cx + Math.cos(radians) * spokeLength, cy + Math.sin(radians) * spokeLength];
        return (
          <g key={angle}>
            <line x1={cx} y1={cy} x2={end[0]} y2={end[1]} stroke={C.white} strokeWidth="0.15" strokeLinecap="round" />
            <circle cx={end[0]} cy={end[1]} r={0.13} fill={C.white} />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={0.24} fill={C.white} />
    </g>
  );
}

/** Server rack units on the block's right face: seams, a drive slot and two status lights per unit. */
function RackFace() {
  const unit = BLOCK.h / RACK_UNITS;
  return (
    <g transform={rightPlane(BLOCK.x + BLOCK.w, BLOCK.y + BLOCK.d, BLOCK.z)}>
      {Array.from({ length: RACK_UNITS }, (_, index) => {
        const base = index * unit;
        return (
          <g key={index}>
            {index > 0 && (
              <line x1={0} y1={base} x2={BLOCK.d} y2={base} stroke={C.ind700} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            )}
            <rect x={0.45} y={base + 0.55} width={2.9} height={0.34} rx={0.17} fill={C.ind700} />
            <rect x={4.15} y={base + 0.58} width={0.28} height={0.28} rx={0.07} fill={index === RACK_UNITS - 1 ? C.white : C.ind300} />
            <rect x={4.7} y={base + 0.58} width={0.28} height={0.28} rx={0.07} fill={C.ind300} />
          </g>
        );
      })}
    </g>
  );
}

const SHEET = { w: 3.1, d: 4, h: 0.13 };
// Small offsets so the stack looks placed by hand, while every edge stays on the grid.
const SHEET_OFFSETS = [
  [0, 0],
  [0.14, -0.1],
  [-0.08, 0.1],
  [0.06, 0.02],
];
const SHEET_X = BLOCK.x + (BLOCK.w - SHEET.w) / 2;
const SHEET_Y = BLOCK.y + (BLOCK.d - SHEET.d) / 2;

/** The stack of documents on top of the vault. The top sheet carries a header bar, text lines and a check stamp. */
function DocumentStack() {
  const topIndex = SHEET_OFFSETS.length - 1;
  const [tx, ty] = SHEET_OFFSETS[topIndex];
  const topZ = BLOCK_TOP + SHEET_OFFSETS.length * SHEET.h;
  const textLines = [2.3, 1.9, 2.3, 1.5, 2.1];
  return (
    <g>
      <Shadow x={SHEET_X} y={SHEET_Y} z={BLOCK_TOP} w={SHEET.w} d={SHEET.d} dx={0.35} dy={0.2} fill={C.ind300} />
      {SHEET_OFFSETS.map(([dx, dy], index) => (
        <Box
          key={index}
          x={SHEET_X + dx}
          y={SHEET_Y + dy}
          z={BLOCK_TOP + index * SHEET.h}
          w={SHEET.w}
          d={SHEET.d}
          h={SHEET.h}
          top={C.white}
          left={C.lav200}
          right={C.lav300}
        />
      ))}
      <g transform={topPlane(SHEET_X + tx, SHEET_Y + ty, topZ)}>
        <rect x={0.35} y={0.4} width={1.35} height={0.3} rx={0.15} fill={C.ind500} />
        {textLines.map((length, index) => (
          <rect key={index} x={0.35} y={1.05 + index * 0.42} width={length} height={0.14} rx={0.07} fill={C.lav300} />
        ))}
        <circle cx={2.45} cy={3.4} r={0.32} fill={C.ind500} />
        <path
          d="M2.3 3.4 L2.41 3.52 L2.62 3.28"
          fill="none"
          stroke={C.white}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </g>
  );
}

const LOCK = { x: 1, y: 9, w: 1.7, d: 0.9, z: FLOOR, h: 1.5 };

/**
 * A padlock standing in front of the vault: shackle first, so the body covers its legs.
 * The plane flips the y axis, so the arc's sweep flag is 0 to bend it upwards on screen.
 */
function Padlock() {
  const lockTop = LOCK.z + LOCK.h;
  return (
    <g>
      <Shadow x={LOCK.x} y={LOCK.y} z={FLOOR} w={LOCK.w} d={LOCK.d} dx={0.55} dy={0.3} />
      <g transform={leftPlane(LOCK.x, LOCK.y + LOCK.d / 2, lockTop)}>
        <path
          d="M0.4 -0.1 L0.4 0.62 A0.45 0.45 0 0 0 1.3 0.62 L1.3 -0.1"
          fill="none"
          stroke={C.plum300}
          strokeWidth="0.24"
          strokeLinecap="round"
        />
      </g>
      <Box {...LOCK} top={C.plum700} left={C.plum800} right={C.plum900} />
      <g transform={leftPlane(LOCK.x, LOCK.y + LOCK.d, LOCK.z)}>
        <circle cx={LOCK.w / 2} cy={0.88} r={0.17} fill={C.lav100} />
        <rect x={LOCK.w / 2 - 0.065} y={0.42} width={0.13} height={0.42} rx={0.06} fill={C.lav100} />
      </g>
    </g>
  );
}

const SHIELD = { x: 10.4, y: 3.2, width: 2.6, height: 3, depth: 0.3 };
const SHIELD_PATH =
  "M0 2.55 C0.55 2.55 1 2.75 1.3 3 C1.6 2.75 2.05 2.55 2.6 2.55 L2.6 1.45 C2.6 0.65 2 0.25 1.3 0 C0.6 0.25 0 0.65 0 1.45 Z";
const SHIELD_INSET =
  "M0.22 2.36 C0.68 2.36 1.05 2.52 1.3 2.72 C1.55 2.52 1.92 2.36 2.38 2.36 L2.38 1.48 C2.38 0.8 1.88 0.47 1.3 0.25 C0.72 0.47 0.22 0.8 0.22 1.48 Z";

/** An upright shield facing the lower right, extruded by stacking thin slices behind its front face. */
function Shield() {
  const right = SHIELD.y + SHIELD.width;
  const slices = Array.from({ length: 12 }, (_, index) => SHIELD.depth * (1 - index / 12));
  return (
    <g>
      {slices.map((offset) => (
        <path key={offset} d={SHIELD_PATH} transform={rightPlane(SHIELD.x - offset, right, FLOOR)} fill={C.ind300} />
      ))}
      <g transform={rightPlane(SHIELD.x, right, FLOOR)}>
        <path d={SHIELD_PATH} fill={C.white} />
        <path d={SHIELD_INSET} fill="none" stroke={C.ind200} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path
          d="M0.82 1.55 L1.18 1.18 L1.82 1.88"
          fill="none"
          stroke={C.ind500}
          strokeWidth="0.22"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

/** Painter's order: platform, then the block and what sits on it, then the objects in front. */
export default function IsoVault({ className }) {
  return (
    <svg viewBox="0 0 560 420" className={className} role="img" aria-labelledby="iso-vault-title">
      <title id="iso-vault-title">A secure vault with a stack of documents, a padlock and a shield</title>
      <Platform />
      <Shadow x={BLOCK.x} y={BLOCK.y} z={FLOOR} w={BLOCK.w} d={BLOCK.d} dx={1.2} dy={0.5} />
      <Box {...BLOCK} top={C.ind200} left={C.ind500} right={C.ind600} />
      <VaultDoor />
      <RackFace />
      <DocumentStack />
      <Padlock />
      <Shield />
    </svg>
  );
}
