// One-leg balance: the phone sits in the pocket of the standing leg. Sway is the RMS of the
// acceleration left after a slow moving average (gravity, posture, slow leaning) is removed.
// The run ends after 20 s, or earlier when the free foot touches down (a sudden jolt).

import { AccelSample } from './jumpDetector';
import { BALANCE_SECONDS } from './scoring';

export interface BalanceConfig {
  durationS: number;
  /** time to lift the leg after the cue: not judged for sway or touch-down */
  graceS: number;
  /** time constant of the moving average that is subtracted, seconds */
  highpassTauS: number;
  /** residual acceleration that counts as a touch-down jolt, g */
  touchG: number;
  touchHoldS: number;
  /** drop this much of the data right before a touch-down from the sway figure */
  trimBeforeTouchS: number;
}

export const DEFAULT_BALANCE_CONFIG: BalanceConfig = {
  durationS: BALANCE_SECONDS,
  graceS: 2,
  highpassTauS: 0.5,
  touchG: 0.45,
  touchHoldS: 0.02,
  trimBeforeTouchS: 0.3,
};

export interface BalanceResult {
  /** how long the player stayed up, seconds (max durationS) */
  stoodSeconds: number;
  /** RMS sway in milli-g */
  swayMg: number;
  /** RMS rotation in degrees per second */
  gyroDps: number;
  ended: 'time' | 'touch';
}

const RAD_TO_DEG = 180 / Math.PI;

export class BalanceTracker {
  private cfg: BalanceConfig;
  private t0: number | null = null;
  private mean = { x: 0, y: 0, z: 0 };
  private lastT = 0;
  private samples: { t: number; res: number }[] = [];
  private touchRunStart: number | null = null;
  private tEnd: number | null = null;
  private ended: 'time' | 'touch' | null = null;
  private gyroSq = 0;
  private gyroN = 0;
  private live = 0;
  /** gyroscope samples carry their own clock; they are judged by when they arrive, not by time stamp */
  private judging = false;

  constructor(config: Partial<BalanceConfig> = {}) {
    this.cfg = { ...DEFAULT_BALANCE_CONFIG, ...config };
  }

  get done(): boolean {
    return this.ended !== null;
  }

  /** seconds since the run began (0 before the first sample) */
  elapsed(now: number): number {
    return this.t0 === null ? 0 : Math.max(0, now - this.t0);
  }

  /** a smoothed current sway figure for the live display, mg */
  get liveSwayMg(): number {
    return this.live * 1000;
  }

  pushAccel(s: AccelSample): void {
    if (this.ended) return;
    const c = this.cfg;

    if (this.t0 === null) {
      this.t0 = s.t;
      this.mean = { x: s.x, y: s.y, z: s.z };
      this.lastT = s.t;
      return;
    }

    const dt = Math.max(0, s.t - this.lastT);
    this.lastT = s.t;
    const a = 1 - Math.exp(-dt / c.highpassTauS);
    this.mean.x += a * (s.x - this.mean.x);
    this.mean.y += a * (s.y - this.mean.y);
    this.mean.z += a * (s.z - this.mean.z);
    const res = Math.hypot(s.x - this.mean.x, s.y - this.mean.y, s.z - this.mean.z);

    const since = s.t - this.t0;
    this.judging = since >= c.graceS;
    if (!this.judging) return;

    this.live += (1 - Math.exp(-dt / 1)) * (res - this.live);
    this.samples.push({ t: s.t, res });

    if (res > c.touchG) {
      if (this.touchRunStart === null) this.touchRunStart = s.t;
      if (s.t - this.touchRunStart >= c.touchHoldS) {
        this.tEnd = this.touchRunStart;
        this.ended = 'touch';
        this.judging = false;
        return;
      }
    } else {
      this.touchRunStart = null;
    }

    if (since >= c.durationS) {
      this.tEnd = this.t0 + c.durationS;
      this.ended = 'time';
      this.judging = false;
    }
  }

  pushGyro(wx: number, wy: number, wz: number): void {
    if (!this.judging || this.ended) return;
    this.gyroSq += wx * wx + wy * wy + wz * wz;
    this.gyroN += 1;
  }

  result(): BalanceResult {
    const c = this.cfg;
    const t0 = this.t0 ?? 0;
    const ended = this.ended ?? 'time';
    const tEnd = this.tEnd ?? this.lastT;
    const from = t0 + c.graceS;
    const to = ended === 'touch' ? tEnd - c.trimBeforeTouchS : tEnd;

    let sq = 0;
    let n = 0;
    for (const s of this.samples) {
      if (s.t >= from && s.t <= to) {
        sq += s.res * s.res;
        n += 1;
      }
    }
    return {
      stoodSeconds: Math.min(c.durationS, Math.max(0, tEnd - t0)),
      swayMg: n ? Math.sqrt(sq / n) * 1000 : 0,
      gyroDps: this.gyroN ? Math.sqrt(this.gyroSq / this.gyroN) * RAD_TO_DEG : 0,
      ended,
    };
  }
}
