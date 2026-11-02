// Sprint start: the player stands still in the start position, a cue is given by a vibration,
// and the time to the first detectable body movement is the reaction time.
//
// All timestamps must come from ONE clock (the app stamps sensor samples on arrival and takes
// the cue time from the same clock). Absolute values depend on the phone's vibration and sensor
// latency, which is the same for everyone playing on the same phone, so they compare fairly
// with each other but not with lab figures.

import { MIN_REACTION_MS } from './scoring';

export interface ReactionConfig {
  /** how long the player must be still before the start procedure can begin */
  settleS: number;
  /** deviation of |a| from the resting level that counts as movement, g */
  accelThresholdG: number;
  /** rotation speed that counts as movement, rad/s */
  gyroThreshold: number;
  /** earliest believable reaction; movement sooner than this after the cue is anticipation */
  minReactionS: number;
  /** the cue vibration shakes the phone itself; movement in this window is not judged */
  cueMaskS: number;
  /** give up when nobody moves after the cue */
  timeoutS: number;
  baselineTauS: number;
}

/**
 * Length of the start cue (vibration). It must end inside cueMaskS, otherwise the phone's own
 * buzz would be read as the player moving.
 */
export const CUE_MS = 120;

export const DEFAULT_REACTION_CONFIG: ReactionConfig = {
  settleS: 1.0,
  accelThresholdG: 0.1,
  gyroThreshold: 0.6,
  minReactionS: MIN_REACTION_MS / 1000,
  cueMaskS: 0.15,
  timeoutS: 2.5,
  baselineTauS: 0.5,
};

export type ReactionEvent =
  | { type: 'ready' }
  | { type: 'false-start'; reason: 'early' | 'anticipated' }
  | { type: 'result'; reactionMs: number }
  | { type: 'timeout' };

type State = 'settling' | 'armed' | 'signalled' | 'finished';

export class ReactionDetector {
  private cfg: ReactionConfig;
  private state: State = 'settling';
  private baseline: number | null = null;
  private lastT: number | null = null;
  private gyroMag = 0;
  private stillSince: number | null = null;
  private signalT = 0;

  constructor(config: Partial<ReactionConfig> = {}) {
    this.cfg = { ...DEFAULT_REACTION_CONFIG, ...config };
  }

  get phase(): State {
    return this.state;
  }

  /** The cue has just been given at time `t` (same clock as the samples). */
  signal(t: number): void {
    if (this.state === 'armed') {
      this.state = 'signalled';
      this.signalT = t;
    }
  }

  pushGyro(mag: number): void {
    this.gyroMag = mag;
  }

  /** Feed one accelerometer magnitude (g). Returns an event when something decisive happens. */
  pushAccel(t: number, mag: number): ReactionEvent | null {
    const dt = this.lastT === null ? 0 : Math.max(0, t - this.lastT);
    this.lastT = t;
    if (this.baseline === null) this.baseline = mag;
    const moving =
      Math.abs(mag - this.baseline) > this.cfg.accelThresholdG || this.gyroMag > this.cfg.gyroThreshold;

    switch (this.state) {
      case 'settling':
        if (moving) {
          this.stillSince = null;
        } else {
          this.follow(mag, dt);
          if (this.stillSince === null) this.stillSince = t;
          if (t - this.stillSince >= this.cfg.settleS) {
            this.state = 'armed';
            return { type: 'ready' };
          }
        }
        return null;

      case 'armed':
        if (moving) {
          this.state = 'finished';
          return { type: 'false-start', reason: 'early' };
        }
        this.follow(mag, dt);
        return null;

      case 'signalled': {
        const since = t - this.signalT;
        if (since < this.cfg.cueMaskS) return null; // the vibration itself
        if (moving) {
          this.state = 'finished';
          if (since < this.cfg.minReactionS) return { type: 'false-start', reason: 'anticipated' };
          return { type: 'result', reactionMs: since * 1000 };
        }
        if (since > this.cfg.timeoutS) {
          this.state = 'finished';
          return { type: 'timeout' };
        }
        return null;
      }

      case 'finished':
        return null;
    }
  }

  /** the resting level of |a| is tracked while the player is still, so a tilted pocket does not matter */
  private follow(mag: number, dt: number): void {
    const a = 1 - Math.exp(-dt / this.cfg.baselineTauS);
    this.baseline = (this.baseline ?? mag) + a * (mag - (this.baseline ?? mag));
  }
}
