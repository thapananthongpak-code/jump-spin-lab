// Throw speed: the phone is strapped to the forearm of the throwing arm, near the wrist.
//
// 1. While the player stands still, the accelerometer reading is gravity alone (f0).
// 2. During the throw the gyroscope tracks the phone's orientation R (body -> the still pose),
//    so gravity can be taken out of every accelerometer reading:  a = 9.81 * (R f - f0).
// 3. Integrating a gives the phone's velocity; the peak is the arm speed at release.
//
// Only the speed (|v|) is used, so it does not matter whether the platform reports the
// accelerometer with gravity as +1 g or -1 g. Whenever the phone is still again the velocity is
// reset to 0, which keeps sensor drift from building up between throws.

import { AccelSample, GyroSample } from './jumpDetector';

const G = 9.81;

export interface ThrowConfig {
  /** | |f| - 1 g | below this counts as still, g */
  stillAccelG: number;
  /** rotation below this counts as still, rad/s */
  stillGyro: number;
  /** how long the player must be still before a throw can start */
  settleS: number;
  /** gravity-free acceleration that starts a throw, g */
  startAccelG: number;
  /** a real throw has at least this peak acceleration, g */
  minPeakAccelG: number;
  /** stop looking once the speed has dropped this far below its peak */
  endFraction: number;
  /** give up on one throw after this long */
  maxThrowS: number;
  /** faster than this is a glitch, not a human arm */
  maxKmh: number;
  /** a reading this large on any axis, repeated, means the sensor hit its limit */
  accelClipG: number;
  gyroClip: number;
}

export const DEFAULT_THROW_CONFIG: ThrowConfig = {
  stillAccelG: 0.06,
  stillGyro: 0.25,
  settleS: 0.5,
  startAccelG: 0.4,
  minPeakAccelG: 2,
  endFraction: 0.35,
  maxThrowS: 2,
  maxKmh: 200,
  accelClipG: 7.8,
  gyroClip: 34,
};

export type ThrowEvent =
  | { type: 'ready' }
  | { type: 'too-weak' }
  | { type: 'glitch' }
  | { type: 'result'; kmh: number; peakAccelG: number; clipped: boolean };

type Vec = [number, number, number];
/** row-major 3x3 */
type Mat = [number, number, number, number, number, number, number, number, number];

const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const norm = (v: Vec) => Math.hypot(v[0], v[1], v[2]);
const mulVec = (m: Mat, v: Vec): Vec => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const mulMat = (a: Mat, b: Mat): Mat => {
  const r = new Array(9) as unknown as Mat;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j];
  return r;
};

/** Rotation by the vector w * dt (axis-angle), exact for a constant rate over the step. */
function rotation(w: Vec, dt: number): Mat {
  const angle = norm(w) * dt;
  if (angle < 1e-9) return IDENTITY;
  const [x, y, z] = w.map((c) => (c * dt) / angle) as Vec;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = 1 - c;
  return [
    c + x * x * k, x * y * k - z * s, x * z * k + y * s,
    y * x * k + z * s, c + y * y * k, y * z * k - x * s,
    z * x * k - y * s, z * y * k + x * s, c + z * z * k,
  ];
}

type State = 'settling' | 'ready' | 'throwing' | 'finished';

export class ThrowTracker {
  private cfg: ThrowConfig;
  private state: State = 'settling';
  private gyro: Vec = [0, 0, 0];
  private prevGyro: Vec = [0, 0, 0];
  private lastT: number | null = null;
  private stillSince: number | null = null;
  private stillSum: Vec = [0, 0, 0];
  private stillN = 0;

  private f0: Vec = [0, 0, -1];
  private R: Mat = IDENTITY;
  private v: Vec = [0, 0, 0];

  private startT = 0;
  private peakV = 0;
  private peakT = 0;
  private peakA = 0;
  private clipped = false;
  private lastRaw: { a: Vec; w: Vec } | null = null;

  constructor(config: Partial<ThrowConfig> = {}) {
    this.cfg = { ...DEFAULT_THROW_CONFIG, ...config };
  }

  get phase(): State {
    return this.state;
  }

  /** current speed in km/h, for a live readout */
  get speedKmh(): number {
    return norm(this.v) * 3.6;
  }

  pushGyro(s: GyroSample): void {
    this.gyro = [s.x, s.y, s.z];
  }

  /** Feed one accelerometer sample (g). Returns an event when something decisive happens. */
  pushAccel(s: AccelSample): ThrowEvent | null {
    const f: Vec = [s.x, s.y, s.z];
    const dt = this.lastT === null ? 0 : Math.max(0, Math.min(0.05, s.t - this.lastT));
    this.lastT = s.t;
    const w = this.gyro;
    const still = Math.abs(norm(f) - 1) < this.cfg.stillAccelG && norm(w) < this.cfg.stillGyro;

    if (this.state === 'settling') {
      this.trackStill(still, f, s.t);
      if (this.stillSince !== null && s.t - this.stillSince >= this.cfg.settleS) {
        this.rezero();
        this.state = 'ready';
        return { type: 'ready' };
      }
      this.prevGyro = w;
      return null;
    }
    if (this.state === 'finished') return null;

    // orientation: trapezoid of the gyro rate over the step
    const wMid: Vec = [(w[0] + this.prevGyro[0]) / 2, (w[1] + this.prevGyro[1]) / 2, (w[2] + this.prevGyro[2]) / 2];
    this.prevGyro = w;
    this.R = mulMat(this.R, rotation(wMid, dt));
    const fw = mulVec(this.R, f);
    const a: Vec = [G * (fw[0] - this.f0[0]), G * (fw[1] - this.f0[1]), G * (fw[2] - this.f0[2])];
    this.v = [this.v[0] + a[0] * dt, this.v[1] + a[1] * dt, this.v[2] + a[2] * dt];
    const aG = norm(a) / G;

    if (this.state === 'ready') {
      this.trackStill(still, f, s.t);
      // still again: start over from this pose, so drift and small fidgets never add up
      if (this.stillSince !== null && s.t - this.stillSince >= 0.2) this.rezero();
      if (aG > this.cfg.startAccelG) {
        this.state = 'throwing';
        this.startT = s.t;
        this.peakV = 0;
        this.peakA = 0;
        this.clipped = false;
      } else {
        return null;
      }
    }

    // throwing
    this.noteClipping(f, w);
    this.peakA = Math.max(this.peakA, aG);
    const speed = norm(this.v);
    if (speed > this.peakV) {
      this.peakV = speed;
      this.peakT = s.t;
    }
    const slowedDown = this.peakV > 0 && speed < this.cfg.endFraction * this.peakV && s.t - this.peakT > 0.1;
    // the arm has come to rest: also the end when a clipped sensor leaves the speed stuck high
    this.trackStill(still, f, s.t);
    const stopped = this.stillSince !== null && s.t - this.stillSince >= 0.15;
    if (slowedDown || stopped || s.t - this.startT > this.cfg.maxThrowS) {
      this.state = 'finished';
      if (this.peakA < this.cfg.minPeakAccelG) return { type: 'too-weak' };
      const kmh = this.peakV * 3.6;
      if (kmh > this.cfg.maxKmh) return { type: 'glitch' };
      return { type: 'result', kmh, peakAccelG: this.peakA, clipped: this.clipped };
    }
    return null;
  }

  private trackStill(still: boolean, f: Vec, t: number): void {
    if (!still) {
      this.stillSince = null;
      this.stillSum = [0, 0, 0];
      this.stillN = 0;
      return;
    }
    if (this.stillSince === null) this.stillSince = t;
    this.stillSum = [this.stillSum[0] + f[0], this.stillSum[1] + f[1], this.stillSum[2] + f[2]];
    this.stillN += 1;
  }

  /** the current pose becomes the reference: gravity = the mean still reading, speed = 0 */
  private rezero(): void {
    if (this.stillN > 0) this.f0 = this.stillSum.map((c) => c / this.stillN) as Vec;
    this.R = IDENTITY;
    this.v = [0, 0, 0];
    this.stillSince = null;
    this.stillSum = [0, 0, 0];
    this.stillN = 0;
  }

  /** two identical readings at the sensor's limit in a row = the real value was larger */
  private noteClipping(a: Vec, w: Vec): void {
    const prev = this.lastRaw;
    this.lastRaw = { a, w };
    if (!prev) return;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(a[i]) >= this.cfg.accelClipG && a[i] === prev.a[i]) this.clipped = true;
      if (Math.abs(w[i]) >= this.cfg.gyroClip && w[i] === prev.w[i]) this.clipped = true;
    }
  }
}
