// Fair scoring: measured values are always shown as measured; only the *score* is adjusted.
//
// Height score
//   1. Peak leg power from jump height and body mass, Sayers et al. (1999),
//      Med Sci Sports Exerc 31(4):572-577, squat-jump equation:
//         P [W] = 60.7 * jumpHeight [cm] + 45.3 * mass [kg] - 2055
//      The paper recommends this equation and reports only ~2.7 % overestimation when it is
//      applied to countermovement jumps, which is the same for every player.
//   2. Allometric scaling P / mass^0.67, so big people are not favoured just for being big.
//   3. Divide by the expected value for the player's age and sex.
//   4. 100 points = the reference person: a young adult man, 70 kg, jumping 40 cm.
//
// The age and sex factors below are NOT from a published norm table (none was found for
// this app's use). They are rough estimates of how leg power changes over a lifetime and
// differs between sexes. They live in this one file so they are easy to inspect and change.

import { Gender, Player } from './types';

export const REFERENCE = { heightCm: 40, massKg: 70 };
const ALLOMETRIC_EXPONENT = 0.67;
const REFERENCE_SPIN_DEG = 360;

/** [age in years, relative leg power]; young adults (20-29) = 1. Linear in between. */
const AGE_POWER_CURVE: [number, number][] = [
  [6, 0.45],
  [10, 0.55],
  [13, 0.7],
  [16, 0.9],
  [20, 1.0],
  [29, 1.0],
  [40, 0.9],
  [50, 0.78],
  [60, 0.65],
  [70, 0.52],
  [80, 0.4],
  [90, 0.3],
];

const SEX_FACTOR: Record<Gender, number> = { male: 1.0, female: 0.8, other: 0.9 };

export function peakPowerW(heightCm: number, massKg: number): number {
  return Math.max(0, 60.7 * heightCm + 45.3 * massKg - 2055);
}

export function relativePower(heightCm: number, massKg: number): number {
  return peakPowerW(heightCm, massKg) / Math.pow(massKg, ALLOMETRIC_EXPONENT);
}

/** Linear interpolation in a [x, y] table, clamped to its ends. */
export function lerpTable(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  if (x >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

export function ageFactor(age: number): number {
  return lerpTable(AGE_POWER_CURVE, age);
}

export function sexFactor(gender: Gender): number {
  return SEX_FACTOR[gender];
}

type Scorer = Pick<Player, 'weightKg' | 'age' | 'gender'>;

export function heightScore(heightCm: number, p: Scorer): number {
  const expected =
    relativePower(REFERENCE.heightCm, REFERENCE.massKg) * ageFactor(p.age) * sexFactor(p.gender);
  return (100 * relativePower(heightCm, p.weightKg)) / expected;
}

/** Spin ability changes less with age than power, hence the square root. */
export function spinScore(spinDeg: number, p: Pick<Player, 'age'>): number {
  return (100 * spinDeg) / (REFERENCE_SPIN_DEG * Math.sqrt(ageFactor(p.age)));
}

// ---------------------------------------------------------------------------------------
// Reaction and balance. Same principle as above: show what was measured, score against what is
// expected for the player's age (and sex where it matters). 100 points = the reference
// person. None of the reference values below come from a published norm table; they are
// starting estimates meant to be re-centred on real test data (see README).
// ---------------------------------------------------------------------------------------

/** Reaction: time from the cue to the first detectable body movement, young adult = 300 ms. */
export const REACTION_REF_MS = 300;
/** Earliest believable reaction; anything quicker is an anticipated (false) start. */
export const MIN_REACTION_MS = 100;
const REACTION_AGE_CURVE: [number, number][] = [
  [6, 1.5], [10, 1.25], [13, 1.1], [16, 1.03], [20, 1.0], [29, 1.0],
  [40, 1.08], [50, 1.15], [60, 1.25], [70, 1.4], [80, 1.6], [90, 1.8],
];

export function reactionExpectedMs(age: number): number {
  return REACTION_REF_MS * lerpTable(REACTION_AGE_CURVE, age);
}

/** A false start scores 0. */
export function reactionScore(ms: number, foul: boolean, p: Pick<Player, 'age'>): number {
  if (foul || ms <= 0) return 0;
  return Math.round((100 * reactionExpectedMs(p.age)) / ms * 10) / 10;
}

/** Balance: stand on one leg for 20 s; sway is the RMS of high-passed acceleration in mg. */
export const BALANCE_SECONDS = 20;
export const BALANCE_REF_SWAY_MG = 20;
const MIN_SWAY_MG = 2; // avoids dividing by a sensor-noise-sized number
const BALANCE_SWAY_AGE_CURVE: [number, number][] = [
  [6, 1.6], [10, 1.35], [13, 1.15], [16, 1.05], [20, 1.0], [35, 1.0],
  [45, 1.25], [55, 1.55], [65, 1.95], [75, 2.5], [90, 3.2],
];

export function balanceExpectedSwayMg(age: number): number {
  return BALANCE_REF_SWAY_MG * lerpTable(BALANCE_SWAY_AGE_CURVE, age);
}

/** Steadiness can lift a score by at most 50 %, so staying up for the full time always matters most. */
export const BALANCE_MAX_STEADINESS = 1.5;

/** Time share (0..1) x steadiness (0..1.5): a full, very still run is worth at most 150. */
export function balanceScore(stoodSeconds: number, swayMg: number, p: Pick<Player, 'age'>): number {
  const time = Math.min(1, Math.max(0, stoodSeconds) / BALANCE_SECONDS);
  const steadiness = Math.min(
    BALANCE_MAX_STEADINESS,
    balanceExpectedSwayMg(p.age) / Math.max(swayMg, MIN_SWAY_MG),
  );
  return Math.round(100 * time * steadiness * 10) / 10;
}

/**
 * Throw: peak speed of the forearm (where the phone is strapped), young adult man = 50 km/h.
 * The ball leaves the hand faster than the forearm moves, so this is not a ball speed.
 */
export const THROW_REF_KMH = 50;
const THROW_SEX_FACTOR: Record<Gender, number> = { male: 1.0, female: 0.8, other: 0.9 };

export function throwExpectedKmh(p: Pick<Player, 'age' | 'gender'>): number {
  return THROW_REF_KMH * Math.sqrt(ageFactor(p.age)) * THROW_SEX_FACTOR[p.gender];
}

export function throwScore(kmh: number, p: Pick<Player, 'age' | 'gender'>): number {
  return Math.round(((100 * Math.max(0, kmh)) / throwExpectedKmh(p)) * 10) / 10;
}
