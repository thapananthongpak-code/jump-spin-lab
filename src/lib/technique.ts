// Technique demos: a side-view stick figure showing how to do each test correctly, so the
// sensor sees the movement it expects. Pure data + math here; drawing is in TechniqueDemo.
//
// Coordinates: a 240 x 240 box, y grows down, the ground is at GROUND_Y, the figure faces +x.
// Key poses give end points (hip, feet, hands); knees and elbows are solved with two-bone IK,
// so limbs never stretch however the poses are blended.

import { SportId } from './types';

export const VIEW = { w: 240, h: 240 };
export const GROUND_Y = 222;
export const SEG = { thigh: 42, shin: 42, torso: 58, neck: 18, upperArm: 30, forearm: 30, head: 11 };

type P = [number, number];

export interface Pose {
  hip: P;
  /** torso angle from vertical in degrees, + = leaning forward */
  lean: number;
  /** near (F) and far (B) side of the body */
  footF: P;
  footB: P;
  handF: P;
  handB: P;
  /** elbow bend -1..1; 1 = elbow behind/below the line shoulder->hand, -1 = the other side */
  elbowF?: number;
  elbowB?: number;
  /** turn about the vertical axis in degrees (spin jump) */
  yaw?: number;
  /** show the phone vibrating */
  buzz?: boolean;
}

export type Ease = 'linear' | 'in' | 'out' | 'inOut';

export interface Key {
  /** seconds from the start of the loop */
  at: number;
  pose: Pose;
  /** caption shown from this key on */
  step: number;
  /** speech bubble while this key is current */
  say?: string;
  /** easing of the blend that ends at this key */
  ease?: Ease;
}

export type PhoneSpot = 'pocket' | 'forearm';

export interface Demo {
  duration: number;
  keys: Key[];
  steps: string[];
  phone: PhoneSpot;
  /** the most common mistake that spoils the measurement */
  avoid: string;
}

// ---------------------------------------------------------------- pose helpers

const STAND_HIP_Y = GROUND_Y - SEG.thigh - SEG.shin + 2;

const shoulderOf = (hip: P, lean: number): P => {
  const r = (lean * Math.PI) / 180;
  return [hip[0] + SEG.torso * Math.sin(r), hip[1] - SEG.torso * Math.cos(r)];
};
const plus = (a: P, dx: number, dy: number): P => [a[0] + dx, a[1] + dy];
const planted = (x: number): P => [x, GROUND_Y];
const hanging = (hip: P, dx: number): P => [hip[0] + dx, hip[1] + SEG.thigh + SEG.shin - 2];

/** both hands on the hips */
function onHips(hip: P, lean: number, base: Omit<Pose, 'handF' | 'handB' | 'hip' | 'lean'>): Pose {
  const h = plus(hip, 5 * Math.cos((lean * Math.PI) / 180), -6);
  return { ...base, hip, lean, handF: h, handB: plus(h, -3, 0), elbowF: 1, elbowB: 1 };
}

/** arms folded in front of the chest */
function folded(hip: P, lean: number, base: Omit<Pose, 'handF' | 'handB' | 'hip' | 'lean'>): Pose {
  const s = shoulderOf(hip, lean);
  return { ...base, hip, lean, handF: plus(s, 12, 18), handB: plus(s, 9, 16), elbowF: 1, elbowB: 1 };
}

// ---------------------------------------------------------------- the demos

const X = 110;
const stand = (hipY = STAND_HIP_Y, lean = 0, x = X) => ({ hip: [x, hipY] as P, lean });

function jumpKeys(spin: boolean): Key[] {
  const arms = spin ? folded : onHips;
  const feet = (x = X) => ({ footF: planted(x + 6), footB: planted(x - 4) });
  const k = (at: number, s: { hip: P; lean: number }, f: { footF: P; footB: P }, step: number, extra: Partial<Key> = {}, yaw = 0): Key => ({
    at,
    step,
    pose: { ...arms(s.hip, s.lean, { ...f }), yaw },
    ...extra,
  });
  const apex = stand(STAND_HIP_Y - 46, 2);
  const air = (s: { hip: P }) => ({ footF: hanging(s.hip, 4), footB: hanging(s.hip, -4) });
  return [
    k(0, stand(), feet(), 0),
    k(1.0, stand(), feet(), 0),
    k(1.35, stand(STAND_HIP_Y + 20, 22, X - 4), feet(), 1, { ease: 'inOut' }),
    k(1.55, stand(STAND_HIP_Y - 4, 4), feet(), 1, { ease: 'in' }),
    k(1.9, apex, air(apex), 2, { ease: 'out', say: spin ? 'Turn!' : undefined }, spin ? 180 : 0),
    k(2.25, stand(STAND_HIP_Y - 2, 2), air(stand(STAND_HIP_Y - 2)), 3, { ease: 'in' }, spin ? 360 : 0),
    k(2.45, stand(STAND_HIP_Y + 14, 14, X - 2), feet(), 3, { ease: 'out' }, spin ? 360 : 0),
    k(2.95, stand(), feet(), 3, { ease: 'inOut' }, spin ? 360 : 0),
    k(4.2, stand(), feet(), 3, {}, spin ? 360 : 0),
  ];
}

const HIGH_JUMP: Demo = {
  duration: 4.2,
  phone: 'pocket',
  keys: jumpKeys(false),
  steps: [
    'Phone snug in your front trouser pocket. Hands on hips, stand still.',
    'Dip quickly and jump straight up.',
    'Keep your legs straight in the air. Do not tuck your knees.',
    'Land on both feet, then stand still again.',
  ],
  avoid: 'Holding the phone in your hand: arm swings fool the sensor.',
};

const SPIN_JUMP: Demo = {
  duration: 4.2,
  phone: 'pocket',
  keys: jumpKeys(true),
  steps: [
    'Phone snug in your front trouser pocket. Arms in, stand still.',
    'Dip and jump straight up.',
    'Turn your whole body around in the air.',
    'Land on both feet, then stand still again.',
  ],
  avoid: 'Twisting only your shoulders: the phone on your hip must turn too.',
};

function sprintKeys(): Key[] {
  const set = (buzz = false): Pose => {
    const hip: P = [92, STAND_HIP_Y + 14];
    const s = shoulderOf(hip, 34);
    return { hip, lean: 34, footF: planted(116), footB: planted(70), handF: plus(s, -16, 24), handB: plus(s, 18, 22), elbowF: 1, elbowB: -0.6, buzz };
  };
  const drive = (): Pose => {
    const hip: P = [128, STAND_HIP_Y + 4];
    const s = shoulderOf(hip, 40);
    return { hip, lean: 40, footF: planted(120), footB: [150, GROUND_Y - 30], handF: plus(s, 20, 18), handB: plus(s, -18, 22), elbowF: -0.6, elbowB: 1 };
  };
  const stride = (): Pose => {
    const hip: P = [172, STAND_HIP_Y + 2];
    const s = shoulderOf(hip, 30);
    return { hip, lean: 30, footF: [196, GROUND_Y - 24], footB: planted(160), handF: plus(s, -18, 22), handB: plus(s, 20, 16), elbowF: 1, elbowB: -0.6 };
  };
  const p = set();
  return [
    { at: 0, step: 0, pose: p, say: 'On your marks' },
    { at: 1.3, step: 1, pose: p, say: 'Set' },
    { at: 2.7, step: 2, pose: set(true), say: 'GO!' },
    { at: 3.0, step: 2, pose: set(false), say: 'GO!' },
    { at: 3.35, step: 2, pose: drive(), ease: 'out' },
    { at: 3.8, step: 2, pose: stride(), ease: 'linear' },
    { at: 4.6, step: 2, pose: stride() },
  ];
}

const SPRINT_START: Demo = {
  duration: 4.6,
  phone: 'pocket',
  keys: sprintKeys(),
  steps: [
    'Phone snug in your front pocket. One foot forward, knees bent, lean in.',
    'On "Set", freeze completely. Any movement now is a false start.',
    'Feel the buzz and push off at once. Do not wait for the voice.',
  ],
  avoid: 'Rocking or creeping forward before the buzz.',
};

function throwKeys(): Key[] {
  const pose = (hip: P, lean: number, footF: P, footB: P, handF: (s: P) => P, handB: (s: P) => P, elbowF: number, elbowB = 1): Pose => {
    const s = shoulderOf(hip, lean);
    return { hip, lean, footF, footB, handF: handF(s), handB: handB(s), elbowF, elbowB };
  };
  const cocked = pose([96, STAND_HIP_Y + 4], -8, planted(126), planted(76), (s) => plus(s, -14, -40), (s) => plus(s, 30, 6), -0.9, -0.3);
  const overhead = pose([106, STAND_HIP_Y + 6], 8, planted(126), planted(80), (s) => plus(s, 8, -50), (s) => plus(s, 12, 34), -0.2, 1);
  const release = pose([114, STAND_HIP_Y + 8], 22, planted(126), planted(86), (s) => plus(s, 44, -4), (s) => plus(s, -10, 40), 0, 1);
  const follow = pose([118, STAND_HIP_Y + 12], 36, planted(128), [104, GROUND_Y - 14], (s) => plus(s, 10, 52), (s) => plus(s, -16, 34), 0.6, 1);
  return [
    { at: 0, step: 0, pose: cocked },
    { at: 1.4, step: 1, pose: cocked, say: 'Throw!' },
    { at: 1.75, step: 1, pose: cocked, say: 'Throw!' },
    { at: 2.0, step: 2, pose: overhead, ease: 'in' },
    { at: 2.15, step: 2, pose: release, ease: 'linear' },
    { at: 2.45, step: 3, pose: follow, ease: 'out' },
    { at: 3.4, step: 3, pose: follow },
    { at: 4.4, step: 0, pose: cocked, ease: 'inOut' },
    { at: 4.8, step: 0, pose: cocked },
  ];
}

const THROW_SPEED: Demo = {
  duration: 4.8,
  phone: 'forearm',
  keys: throwKeys(),
  steps: [
    'Strap the phone tightly to your throwing forearm, near the wrist. Arm back, hold still.',
    'Wait for "Throw!". The app needs you still first.',
    'Whip your arm over your shoulder as fast as you can.',
    'Follow through across your body. Never let go of the phone.',
  ],
  avoid: 'A loose strap: the phone slides and the speed comes out wrong.',
};

function balanceKeys(): Key[] {
  const base = (dx: number, lifted: boolean): Pose =>
    onHips([X + dx, STAND_HIP_Y], 0, {
      footF: planted(X + 2),
      footB: lifted ? [X + dx + 14, GROUND_Y - 44] : planted(X - 8),
    });
  return [
    { at: 0, step: 0, pose: base(0, false) },
    { at: 1.2, step: 1, pose: base(0, false), say: 'Lift your leg' },
    { at: 1.6, step: 1, pose: base(0.5, true), ease: 'inOut', say: 'Lift your leg' },
    { at: 2.3, step: 2, pose: base(-1.2, true), ease: 'inOut' },
    { at: 3.0, step: 2, pose: base(1.2, true), ease: 'inOut' },
    { at: 3.7, step: 2, pose: base(-0.8, true), ease: 'inOut' },
    { at: 4.4, step: 2, pose: base(0, true), ease: 'inOut' },
    { at: 4.8, step: 0, pose: base(0, false), ease: 'inOut' },
    { at: 5.4, step: 0, pose: base(0, false) },
  ];
}

const BALANCE: Demo = {
  duration: 5.4,
  phone: 'pocket',
  keys: balanceKeys(),
  steps: [
    'Phone in the pocket of the leg you will stand on. Hands on hips, stand still.',
    'On the signal, lift the other foot off the ground.',
    'Stay as still as you can. The raised foot must not touch down.',
  ],
  avoid: 'Waving your arms to balance: keep your hands on your hips.',
};

export const DEMOS: Record<SportId, Demo> = {
  height: HIGH_JUMP,
  spin: SPIN_JUMP,
  reaction: SPRINT_START,
  throw: THROW_SPEED,
  balance: BALANCE,
};

// ---------------------------------------------------------------- blending + solving

const easeFn: Record<Ease, (u: number) => number> = {
  linear: (u) => u,
  in: (u) => u * u,
  out: (u) => 1 - (1 - u) * (1 - u),
  inOut: (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)),
};

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpP = (a: P, b: P, u: number): P => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];

export interface Frame {
  pose: Pose;
  step: number;
  say?: string;
}

/** The pose at time t (looping). */
export function frameAt(demo: Demo, t: number): Frame {
  const time = ((t % demo.duration) + demo.duration) % demo.duration;
  const keys = demo.keys;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].at <= time) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const span = b.at - a.at;
  const u = span > 0 ? easeFn[b.ease ?? 'inOut'](Math.min(1, (time - a.at) / span)) : 0;
  const pa = a.pose;
  const pb = b.pose;
  return {
    step: a.step,
    say: a.say,
    pose: {
      hip: lerpP(pa.hip, pb.hip, u),
      lean: lerp(pa.lean, pb.lean, u),
      footF: lerpP(pa.footF, pb.footF, u),
      footB: lerpP(pa.footB, pb.footB, u),
      handF: lerpP(pa.handF, pb.handF, u),
      handB: lerpP(pa.handB, pb.handB, u),
      elbowF: lerp(pa.elbowF ?? 1, pb.elbowF ?? 1, u),
      elbowB: lerp(pa.elbowB ?? 1, pb.elbowB ?? 1, u),
      yaw: lerp(pa.yaw ?? 0, pb.yaw ?? 0, u),
      buzz: pa.buzz,
    },
  };
}

/**
 * Two-bone IK: the middle joint for a limb from `a` towards `target`. `bend` -1..1 picks the
 * side and how far it bends; an out-of-reach target leaves the limb straight towards it.
 */
export function solveJoint(a: P, target: P, l1: number, l2: number, bend: number): { mid: P; end: P } {
  const dx = target[0] - a[0];
  const dy = target[1] - a[1];
  const dist = Math.hypot(dx, dy) || 1e-6;
  const d = Math.min(dist, l1 + l2 - 1e-6);
  const ux = dx / dist;
  const uy = dy / dist;
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  // angle between the first bone and the line to the target for a full bend; a partial bend
  // turns the bone part of the way, so it keeps its length (the end may then fall short)
  const full = Math.acos(Math.max(-1, Math.min(1, along / l1)));
  const phi = Math.max(-1, Math.min(1, bend)) * full;
  // perpendicular (-uy, ux): for a limb pointing down it points backwards (-x)
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const mid: P = [a[0] + l1 * (c * ux - s * uy), a[1] + l1 * (c * uy + s * ux)];
  const ex = target[0] - mid[0];
  const ey = target[1] - mid[1];
  const el = Math.hypot(ex, ey) || 1e-6;
  return { mid, end: [mid[0] + (ex / el) * l2, mid[1] + (ey / el) * l2] };
}

export interface Skeleton {
  hip: P;
  shoulder: P;
  head: P;
  kneeF: P;
  footF: P;
  kneeB: P;
  footB: P;
  elbowF: P;
  handF: P;
  elbowB: P;
  handB: P;
  /** where the phone sits and its angle in degrees */
  phone: { at: P; angle: number };
  /** cos(yaw): squashes the figure sideways to show turning */
  turn: number;
}

const along = (a: P, b: P, f: number): P => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
const angleOf = (a: P, b: P) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

export function solve(pose: Pose, phone: PhoneSpot): Skeleton {
  const shoulder = shoulderOf(pose.hip, pose.lean);
  const r = (pose.lean * Math.PI) / 180;
  const neck = SEG.torso + SEG.neck;
  const head: P = [pose.hip[0] + neck * Math.sin(r), pose.hip[1] - neck * Math.cos(r)];
  // knees bend forward (bend -1), elbows as the pose says
  const legF = solveJoint(pose.hip, pose.footF, SEG.thigh, SEG.shin, -1);
  const legB = solveJoint(pose.hip, pose.footB, SEG.thigh, SEG.shin, -1);
  const armF = solveJoint(shoulder, pose.handF, SEG.upperArm, SEG.forearm, pose.elbowF ?? 1);
  const armB = solveJoint(shoulder, pose.handB, SEG.upperArm, SEG.forearm, pose.elbowB ?? 1);
  const spot =
    phone === 'pocket'
      ? { at: along(pose.hip, legF.mid, 0.45), angle: angleOf(pose.hip, legF.mid) }
      : { at: along(armF.mid, armF.end, 0.72), angle: angleOf(armF.mid, armF.end) };
  return {
    hip: pose.hip,
    shoulder,
    head,
    kneeF: legF.mid,
    footF: legF.end,
    kneeB: legB.mid,
    footB: legB.end,
    elbowF: armF.mid,
    handF: armF.end,
    elbowB: armB.mid,
    handB: armB.end,
    phone: spot,
    turn: Math.cos(((pose.yaw ?? 0) * Math.PI) / 180),
  };
}
