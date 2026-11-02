// Jump detector: pure logic, no React / Expo imports so it can be unit tested.
// Units: accelerometer in g (gravity included, so ~1 g at rest and ~0 g in free fall),
// gyroscope in rad/s, timestamps in seconds.

export const GRAVITY = 9.80665;

export interface AccelSample {
  t: number;
  x: number;
  y: number;
  z: number;
}

export interface GyroSample {
  t: number;
  x: number;
  y: number;
  z: number;
}

export interface DetectorConfig {
  flightEnterG: number;
  flightExitG: number;
  minFreefallMs: number;
  minExitMs: number;
  pushoffWindowMs: number;
  minPushoffG: number;
  minFlightMs: number;
  maxFlightMs: number;
  impactWindowMs: number;
  minImpactG: number;
  cooldownMs: number;
  maxGapMs: number;
}

export const DEFAULT_CONFIG: DetectorConfig = {
  flightEnterG: 0.4,
  flightExitG: 0.8,
  minFreefallMs: 30,
  minExitMs: 20,
  pushoffWindowMs: 500,
  minPushoffG: 1.4,
  minFlightMs: 150,
  maxFlightMs: 900,
  impactWindowMs: 200,
  minImpactG: 2.0,
  cooldownMs: 500,
  maxGapMs: 60,
};

export type RejectReason =
  | 'too-short'
  | 'too-long'
  | 'no-pushoff'
  | 'no-impact'
  | 'data-gap';

export interface JumpMeasurement {
  ok: true;
  heightCm: number;
  flightMs: number;
  spinDeg: number;
  impactG: number;
  pushoffG: number;
  startT: number;
  endT: number;
}

export interface JumpRejection {
  ok: false;
  reason: RejectReason;
  flightMs: number;
  startT: number;
}

export type JumpResult = JumpMeasurement | JumpRejection;

export function heightFromFlightTime(flightSeconds: number): number {
  return ((GRAVITY * flightSeconds * flightSeconds) / 8) * 100;
}

type Phase = 'armed' | 'candidate' | 'flight' | 'landing' | 'cooldown';

interface MagSample {
  t: number;
  mag: number;
}

const ACCEL_KEEP_S = 2.5;
const GYRO_KEEP_S = 3;
const GRAVITY_TAU_S = 0.25;
const GRAVITY_TOLERANCE_G = 0.15;
const CLOCK_MISMATCH_S = 1;

export class JumpDetector {
  private readonly cfg: DetectorConfig;
  private phase: Phase = 'armed';
  private recent: MagSample[] = [];
  private gyro: GyroSample[] = [];
  private lastT: number | null = null;
  private lastAccelT = 0;
  private gravity: { x: number; y: number; z: number } | null = null;
  private candidateStart = 0;
  private flightStart = 0;
  private flightEnd = 0;
  private exitRunStart: number | null = null;
  private cooldownUntil = 0;
  private frozenGravity: { x: number; y: number; z: number } | null = null;

  constructor(config: Partial<DetectorConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.phase = 'armed';
    this.recent = [];
    this.gyro = [];
    this.lastT = null;
    this.gravity = null;
    this.frozenGravity = null;
    this.exitRunStart = null;
  }

  pushGyro(s: GyroSample): void {
    this.gyro.push(s);
    const cutoff = s.t - GYRO_KEEP_S;
    while (this.gyro.length > 0 && this.gyro[0].t < cutoff) this.gyro.shift();
  }

  /** Feed one accelerometer sample. Returns a result when a jump attempt completes. */
  pushAccel(s: AccelSample): JumpResult | null {
    const mag = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
    const dt = this.lastT === null ? 0 : s.t - this.lastT;
    this.lastT = s.t;
    this.lastAccelT = s.t;

    this.recent.push({ t: s.t, mag });
    const cutoff = s.t - ACCEL_KEEP_S;
    while (this.recent.length > 0 && this.recent[0].t < cutoff) this.recent.shift();

    const c = this.cfg;
    const gapS = c.maxGapMs / 1000;

    switch (this.phase) {
      case 'cooldown':
        if (s.t >= this.cooldownUntil) this.phase = 'armed';
        this.trackGravity(s, mag, dt);
        return null;

      case 'armed':
        this.trackGravity(s, mag, dt);
        if (mag < c.flightEnterG) {
          this.phase = 'candidate';
          this.candidateStart = s.t;
          this.frozenGravity = this.gravity ? { ...this.gravity } : null;
        }
        return null;

      case 'candidate':
        if (mag >= c.flightEnterG || dt > gapS) {
          this.phase = 'armed';
          return null;
        }
        if ((s.t - this.candidateStart) * 1000 >= c.minFreefallMs) {
          this.phase = 'flight';
          this.flightStart = this.candidateStart;
          this.exitRunStart = null;
        }
        return null;

      case 'flight': {
        if (dt > gapS) return this.reject('data-gap', s.t);
        if ((s.t - this.flightStart) * 1000 > c.maxFlightMs) {
          return this.reject('too-long', s.t);
        }
        if (mag > c.flightExitG) {
          if (this.exitRunStart === null) this.exitRunStart = s.t;
          if ((s.t - this.exitRunStart) * 1000 >= c.minExitMs) {
            this.flightEnd = this.exitRunStart;
            this.phase = 'landing';
          }
        } else {
          this.exitRunStart = null;
        }
        return null;
      }

      case 'landing':
        if (dt > gapS) return this.reject('data-gap', s.t);
        if ((s.t - this.flightEnd) * 1000 >= c.impactWindowMs) return this.finalize(s.t);
        return null;
    }
  }

  private trackGravity(s: AccelSample, mag: number, dt: number): void {
    if (Math.abs(mag - 1) > GRAVITY_TOLERANCE_G) return;
    if (!this.gravity) {
      this.gravity = { x: s.x, y: s.y, z: s.z };
      return;
    }
    const a = 1 - Math.exp(-Math.max(dt, 0) / GRAVITY_TAU_S);
    this.gravity.x += a * (s.x - this.gravity.x);
    this.gravity.y += a * (s.y - this.gravity.y);
    this.gravity.z += a * (s.z - this.gravity.z);
  }

  private reject(reason: RejectReason, now: number): JumpRejection {
    const result: JumpRejection = {
      ok: false,
      reason,
      flightMs: Math.max(0, (now - this.flightStart) * 1000),
      startT: this.flightStart,
    };
    this.enterCooldown(now);
    return result;
  }

  private enterCooldown(now: number): void {
    this.phase = 'cooldown';
    this.cooldownUntil = now + this.cfg.cooldownMs / 1000;
    this.exitRunStart = null;
  }

  private finalize(now: number): JumpResult {
    const c = this.cfg;
    const flightS = this.flightEnd - this.flightStart;
    const flightMs = flightS * 1000;

    let pushoffG = 0;
    const pushFrom = this.flightStart - c.pushoffWindowMs / 1000;
    for (const m of this.recent) {
      if (m.t >= pushFrom && m.t < this.flightStart && m.mag > pushoffG) pushoffG = m.mag;
    }

    let impactG = 0;
    const impactTo = this.flightEnd + c.impactWindowMs / 1000;
    for (const m of this.recent) {
      if (m.t >= this.flightEnd && m.t <= impactTo && m.mag > impactG) impactG = m.mag;
    }

    const fail = (reason: RejectReason): JumpRejection => {
      this.enterCooldown(now);
      return { ok: false, reason, flightMs, startT: this.flightStart };
    };

    if (flightMs < c.minFlightMs) return fail('too-short');
    if (flightMs > c.maxFlightMs) return fail('too-long');
    if (pushoffG < c.minPushoffG) return fail('no-pushoff');
    if (impactG < c.minImpactG) return fail('no-impact');

    const result: JumpMeasurement = {
      ok: true,
      heightCm: heightFromFlightTime(flightS),
      flightMs,
      spinDeg: this.integrateSpin(this.flightStart, this.flightEnd),
      impactG,
      pushoffG,
      startT: this.flightStart,
      endT: this.flightEnd,
    };
    this.enterCooldown(now);
    return result;
  }

  /**
   * Rotation about the vertical axis (twist) during the flight, in degrees.
   * The vertical axis in phone coordinates is the gravity direction measured while
   * the user stood still; without it we fall back to the total rotation magnitude.
   */
  private integrateSpin(t0: number, t1: number): number {
    if (this.gyro.length < 2) return 0;

    // Sensors may report timestamps from different clocks; align the two streams
    // using their most recent samples when the bases clearly disagree.
    const gyroLast = this.gyro[this.gyro.length - 1].t;
    const mismatch = this.lastAccelT - gyroLast;
    const shift = Math.abs(mismatch) > CLOCK_MISMATCH_S ? mismatch : 0;

    const g = this.frozenGravity ?? this.gravity;
    let gx = 0;
    let gy = 0;
    let gz = 0;
    let useAxis = false;
    if (g) {
      const n = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
      if (n > 0.5) {
        gx = g.x / n;
        gy = g.y / n;
        gz = g.z / n;
        useAxis = true;
      }
    }

    const rate = (s: GyroSample): number =>
      useAxis ? s.x * gx + s.y * gy + s.z * gz : Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);

    let angle = 0;
    for (let i = 1; i < this.gyro.length; i++) {
      const cur = this.gyro[i];
      const prev = this.gyro[i - 1];
      const tc = cur.t + shift;
      if (tc <= t0 || tc > t1) continue;
      angle += 0.5 * (rate(cur) + rate(prev)) * (cur.t - prev.t);
    }
    return Math.abs((angle * 180) / Math.PI);
  }
}

/** Run a whole recording through the detector (used by tests and by the debug replay). */
export function analyzeRecording(
  accel: AccelSample[],
  gyro: GyroSample[],
  config: Partial<DetectorConfig> = {},
): JumpResult[] {
  const detector = new JumpDetector(config);
  const results: JumpResult[] = [];
  let gi = 0;
  for (const a of accel) {
    while (gi < gyro.length && gyro[gi].t <= a.t) detector.pushGyro(gyro[gi++]);
    const r = detector.pushAccel(a);
    if (r) results.push(r);
  }
  return results;
}
