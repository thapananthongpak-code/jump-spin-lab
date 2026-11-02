import { balanceScore, heightScore, reactionScore, spinScore, throwScore } from './scoring';
import { Player, SportId } from './types';

/**
 * One result of one round, whatever the sport. What `value` / `value2` mean is defined by the
 * sport (see SPORTS): jump sports use value = height (cm) and value2 = spin (deg).
 */
export interface Attempt {
  value: number;
  value2?: number;
  /** a rule violation such as a false start: shown as such and scores 0 */
  foul?: boolean;
}

export interface Formatted {
  main: string;
  sub?: string;
}

export type SportCategory = 'jump' | 'speed' | 'control';

export const CATEGORY_LABEL: Record<SportCategory, string> = {
  jump: 'JUMP',
  speed: 'SPEED',
  control: 'BODY CONTROL',
};

export interface SportDef {
  id: SportId;
  icon: string;
  title: string;
  blurb: string;
  category: SportCategory;
  /** attempts per player before the phone is passed on */
  rounds: number;
  /** which sensors this sport reads */
  sensors: string;
  /** where the phone goes, shown before the first round */
  placement: string;
  /** explains the R1..R3 / best columns of the scoreboard */
  tableUnit: string;
  /** measured values as measured, never adjusted */
  format: (a: Attempt) => Formatted;
  /** adjusted points for one attempt; 100 = reference person. Rounded to 0.1 */
  score: (a: Attempt, p: Player) => number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const cm = (a: Attempt) => a.value.toFixed(1);
const deg = (a: Attempt) => `${Math.round(a.value2 ?? 0)}°`;

export const SPORTS: Record<SportId, SportDef> = {
  height: {
    id: 'height',
    icon: '🏀',
    title: 'High Jump',
    blurb: 'Who has the most powerful legs?',
    category: 'jump',
    rounds: 3,
    sensors: 'Accelerometer',
    placement: 'Put the phone snugly in your trouser pocket (or an armband). Jump straight up, hands on hips.',
    tableUnit: 'cm',
    format: (a) => ({ main: cm(a) }),
    score: (a, p) => round1(heightScore(a.value, p)),
  },
  spin: {
    id: 'spin',
    icon: '🌀',
    title: 'Spin Jump',
    blurb: 'Who can rotate the most in the air?',
    category: 'jump',
    rounds: 3,
    sensors: 'Accelerometer + Gyroscope',
    placement: 'Put the phone snugly in your trouser pocket. Jump and turn your body around in the air.',
    tableUnit: '°',
    format: (a) => ({ main: deg(a) }),
    score: (a, p) => round1(spinScore(a.value2 ?? 0, p)),
  },
  reaction: {
    id: 'reaction',
    icon: '⚡',
    title: 'Sprint Start',
    blurb: 'Who reacts fastest to the start signal?',
    category: 'speed',
    rounds: 3,
    sensors: 'Accelerometer + Gyroscope',
    placement: 'Put the phone snugly in your trouser pocket. Hold a still sprint-start stance, wait for the buzz, then burst forward.',
    tableUnit: 'ms',
    format: (a) => (a.foul ? { main: 'FS' } : { main: String(Math.round(a.value)) }),
    score: (a, p) => reactionScore(a.value, !!a.foul, p),
  },
  throw: {
    id: 'throw',
    icon: '⚾',
    title: 'Throw Speed',
    blurb: 'Who has the fastest throwing arm? Measured in km/h',
    category: 'speed',
    rounds: 3,
    sensors: 'Accelerometer + Gyroscope',
    placement:
      'Strap the phone tightly to the forearm of your throwing arm, near the wrist (sports armband). Mime an overarm throw or throw a soft ball. Never let go of the phone and keep clear of people.',
    tableUnit: 'km/h',
    format: (a) => ({ main: a.value.toFixed(1) }),
    score: (a, p) => throwScore(a.value, p),
  },
  balance: {
    id: 'balance',
    icon: '🧘',
    title: 'One-Leg Balance',
    blurb: 'Stand on one leg as still as you can for 20 seconds',
    category: 'control',
    rounds: 3,
    sensors: 'Accelerometer + Gyroscope',
    placement: 'Put the phone in the pocket on your standing leg, hands on hips. Lift the other leg when you hear the signal.',
    tableUnit: 's / mg',
    format: (a) => ({ main: a.value.toFixed(1), sub: `${Math.round(a.value2 ?? 0)}mg` }),
    score: (a, p) => balanceScore(a.value, a.value2 ?? 0, p),
  },
};

export const SPORT_LIST: SportDef[] = [
  SPORTS.height,
  SPORTS.spin,
  SPORTS.reaction,
  SPORTS.throw,
  SPORTS.balance,
];

/** Sports measured with the jump detector and stored in the jumps table. */
export const JUMP_DETECTOR_SPORTS: SportId[] = ['height', 'spin'];
export const usesJumpDetector = (id: SportId): boolean => JUMP_DETECTOR_SPORTS.includes(id);
