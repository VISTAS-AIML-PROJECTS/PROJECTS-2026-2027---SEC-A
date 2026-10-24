/**
 * HandVisualization.jsx
 * ---------------------
 * SVG illustration of piano hands showing correct finger positioning.
 * Used exclusively in LessonDetailPage Wait Mode steps that include
 * fingering data (finger / fingers fields on play-note / play-sequence steps).
 *
 * Finger code format: "R1"–"R5" (right hand) or "L1"–"L5" (left hand)
 *   1 = thumb, 2 = index, 3 = middle, 4 = ring, 5 = pinky
 *   (Universal piano standard — matches all sheet music)
 *
 * Props:
 *   activeFinger  {string|null}  e.g. "R3" — finger to highlight in amber
 *                                             (preview: "this is the finger to use")
 *   pressedFinger {string|null}  e.g. "R3" — finger to animate downward briefly
 *                                             (feedback: "you just played this finger")
 *
 * Design: pure SVG shapes only — rounded rectangles for fingers, rounded rect
 * palm. No photographs, copyrighted images, or external assets.
 *
 * Keyboard layout orientation:
 *   Right hand:  thumb (R1) on left  → pinky (R5) on right  (keyboard-natural)
 *   Left hand:   pinky (L5) on left  → thumb (L1) on right  (keyboard-natural)
 */

// ── Geometry constants ────────────────────────────────────────────────────────

const VB_W       = 130;   // SVG viewBox width
const VB_H       = 115;   // SVG viewBox height
const PALM_X     = 5;
const PALM_Y     = 78;
const PALM_W     = 120;
const PALM_H     = 32;
const PALM_RX    = 11;
const FINGER_W   = 19;
const FINGER_GAP = 5;     // gap between adjacent fingers

// Per-slot geometry (slot 0 = left-most finger in the illustration)
// [yTop, height, rx] — all measured so finger bottom touches PALM_Y
const SLOT_SHAPES = [
  { yTop: 42, h: 36, rx: 9  },   // slot 0  thumb
  { yTop: 23, h: 55, rx: 9  },   // slot 1  index
  { yTop: 17, h: 61, rx: 9  },   // slot 2  middle
  { yTop: 23, h: 55, rx: 9  },   // slot 3  ring
  { yTop: 40, h: 38, rx: 8  },   // slot 4  pinky
];

// Finger-id → slot index mappings
// Right hand: R1(thumb) = slot 0 on the left, R5(pinky) = slot 4 on the right
const R_SLOT = { R1: 0, R2: 1, R3: 2, R4: 3, R5: 4 };
// Left hand:  L5(pinky) = slot 0 on the left, L1(thumb) = slot 4 on the right
const L_SLOT = { L5: 0, L4: 1, L3: 2, L2: 3, L1: 4 };

/** Label digit (1–5) inside the finger shape */
function fingerLabel(side, slotIdx) {
  // RH: slot 0 = finger 1, …, slot 4 = finger 5
  // LH: slot 0 = finger 5, …, slot 4 = finger 1
  return side === 'R' ? slotIdx + 1 : 5 - slotIdx;
}

/** Determine which finger id occupies a given slot on the given side */
function slotToFingerId(side, slotIdx) {
  const map = side === 'R' ? R_SLOT : L_SLOT;
  return Object.keys(map).find((id) => map[id] === slotIdx) ?? null;
}

// ── HandSVG ───────────────────────────────────────────────────────────────────

function HandSVG({ side, activeFinger, pressedFinger }) {
  const handLabel = side === 'R' ? 'Right hand' : 'Left hand';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width={VB_W}
        height={VB_H}
        aria-label={`${handLabel} finger guide`}
        role="img"
        overflow="visible"
      >
        {/* ── Subtle drop shadow def ── */}
        <defs>
          <filter id={`shadow-${side}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* ── Palm ── */}
        <rect
          x={PALM_X}
          y={PALM_Y}
          width={PALM_W}
          height={PALM_H}
          rx={PALM_RX}
          fill="rgb(51,65,85)"          /* slate-700 */
          stroke="rgb(71,85,105)"       /* slate-600 */
          strokeWidth="1"
        />

        {/* ── Wrist hint (two small lines at palm bottom) ── */}
        <line x1={PALM_X + 22} y1={PALM_Y + PALM_H - 1} x2={PALM_X + 22} y2={PALM_Y + PALM_H + 5}
          stroke="rgb(51,65,85)" strokeWidth="3" strokeLinecap="round" />
        <line x1={PALM_X + PALM_W - 22} y1={PALM_Y + PALM_H - 1} x2={PALM_X + PALM_W - 22} y2={PALM_Y + PALM_H + 5}
          stroke="rgb(51,65,85)" strokeWidth="3" strokeLinecap="round" />

        {/* ── Fingers ── */}
        {SLOT_SHAPES.map((shape, slotIdx) => {
          const fingerId   = slotToFingerId(side, slotIdx);
          const isActive   = activeFinger  === fingerId;
          const isPressed  = pressedFinger === fingerId;
          const label      = fingerLabel(side, slotIdx);
          const x          = PALM_X + slotIdx * (FINGER_W + FINGER_GAP);

          // Colour logic
          let fillColor   = 'rgb(71,85,105)';    // slate-600 — idle
          let strokeColor = 'rgb(100,116,139)';  // slate-500
          let textColor   = 'rgb(148,163,184)';  // slate-400
          if (isPressed) {
            fillColor   = 'rgb(99,102,241)';     // indigo-500
            strokeColor = 'rgb(129,140,248)';    // indigo-400
            textColor   = 'rgb(255,255,255)';
          } else if (isActive) {
            fillColor   = 'rgb(251,191,36)';     // amber-400
            strokeColor = 'rgb(252,211,77)';     // amber-300
            textColor   = 'rgb(120,53,15)';      // amber-900
          }

          const pressShift = isPressed ? 4 : 0; // translate down when pressed

          return (
            <g
              key={slotIdx}
              style={{
                transform:  `translateY(${pressShift}px)`,
                transition: 'transform 140ms ease-out',
              }}
            >
              {/* Finger body */}
              <rect
                x={x}
                y={shape.yTop}
                width={FINGER_W}
                height={shape.h}
                rx={shape.rx}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth="1"
                filter={isActive || isPressed ? `url(#shadow-${side})` : undefined}
              />

              {/* Fingernail hint — small rounded rectangle at top */}
              <rect
                x={x + 3}
                y={shape.yTop + 3}
                width={FINGER_W - 6}
                height={8}
                rx={4}
                fill={isPressed ? 'rgb(67,56,202)' : isActive ? 'rgb(245,158,11)' : 'rgb(51,65,85)'}
                opacity="0.7"
              />

              {/* Finger number label */}
              <text
                x={x + FINGER_W / 2}
                y={shape.yTop + shape.h - 8}
                textAnchor="middle"
                fontSize="10"
                fontWeight="800"
                fill={textColor}
                style={{ userSelect: 'none', fontFamily: 'system-ui, sans-serif' }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hand name below SVG */}
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
        {handLabel}
      </p>
    </div>
  );
}

// ── HandVisualization (public) ────────────────────────────────────────────────

/**
 * @param {{ activeFinger: string|null, pressedFinger: string|null }} props
 */
export default function HandVisualization({ activeFinger, pressedFinger }) {
  // Decide which hand to render based on the active/pressed finger code
  const guardFinger = activeFinger || pressedFinger;
  if (!guardFinger) return null;

  const showRight = guardFinger[0] === 'R';
  const showLeft  = guardFinger[0] === 'L';

  return (
    <div
      className="flex flex-col items-center gap-2 py-3 px-4 rounded-xl bg-black/25 border border-white/8"
      aria-label="Finger position guide"
      role="region"
    >
      {/* Header row */}
      <div className="flex items-center justify-between w-full px-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
          Finger Guide
        </p>
        <div className="flex items-center gap-3 text-[9px] text-slate-600">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-amber-400" />
            Use this finger
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-indigo-500" />
            Playing!
          </span>
        </div>
      </div>

      {/* Hand SVGs */}
      <div className="flex items-end justify-center gap-8">
        {showLeft  && (
          <HandSVG
            side="L"
            activeFinger={activeFinger}
            pressedFinger={pressedFinger}
          />
        )}
        {showRight && (
          <HandSVG
            side="R"
            activeFinger={activeFinger}
            pressedFinger={pressedFinger}
          />
        )}
      </div>
    </div>
  );
}
