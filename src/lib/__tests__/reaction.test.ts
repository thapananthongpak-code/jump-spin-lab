import { CUE_MS, DEFAULT_REACTION_CONFIG, ReactionDetector, ReactionEvent } from '../reaction';

const FS = 100;

/** Drives a detector through a scripted scenario and collects events. */
class Scenario {
  d = new ReactionDetector();
  t = 0;
  events: ReactionEvent[] = [];
  private motion: (t: number) => number = () => 0;

  /** extra |a| (g) the body produces at time t */
  moveWhen(fn: (t: number) => number) {
    this.motion = fn;
    return this;
  }

  run(seconds: number, onEach?: (t: number) => void) {
    const n = Math.round(seconds * FS);
    for (let i = 0; i < n; i++) {
      onEach?.(this.t);
      const noise = ((i * 7919) % 13) / 13 * 0.004 - 0.002;
      const e = this.d.pushAccel(this.t, 1 + noise + this.motion(this.t));
      if (e) this.events.push(e);
      this.t += 1 / FS;
    }
    return this;
  }
}

describe('ReactionDetector', () => {
  it('becomes ready after one second of stillness', () => {
    const s = new Scenario().run(1.5);
    expect(s.events).toEqual([{ type: 'ready' }]);
    expect(s.d.phase).toBe('armed');
  });

  it('restarts the stillness timer when the player moves while getting set', () => {
    const s = new Scenario().moveWhen((t) => (t > 0.5 && t < 0.7 ? 0.3 : 0));
    s.run(1.6);
    expect(s.events).toHaveLength(0); // still counting after the interruption
    s.run(0.6);
    expect(s.events).toEqual([{ type: 'ready' }]);
  });

  it('calls movement before the cue a false start', () => {
    const s = new Scenario().moveWhen((t) => (t > 2.2 ? 0.4 : 0));
    s.run(3);
    expect(s.events).toEqual([{ type: 'ready' }, { type: 'false-start', reason: 'early' }]);
  });

  it('measures the time from the cue to the first movement', () => {
    const cueAt = 2.0;
    const s = new Scenario().moveWhen((t) => (t >= cueAt + 0.28 ? 0.5 : 0));
    s.run(4, (t) => {
      if (Math.abs(t - cueAt) < 0.5 / FS) s.d.signal(t);
    });
    const result = s.events.find((e) => e.type === 'result') as { type: 'result'; reactionMs: number };
    expect(result).toBeDefined();
    expect(result.reactionMs).toBeGreaterThan(270);
    expect(result.reactionMs).toBeLessThan(295);
  });

  it('ignores the shaking caused by the cue vibration itself', () => {
    const cueAt = 2.0;
    const vibration = (t: number) => (t >= cueAt && t < cueAt + 0.1 ? 0.6 : 0);
    const body = (t: number) => (t >= cueAt + 0.3 ? 0.5 : 0);
    const s = new Scenario().moveWhen((t) => vibration(t) + body(t));
    s.run(4, (t) => {
      if (Math.abs(t - cueAt) < 0.5 / FS) s.d.signal(t);
    });
    const result = s.events.find((e) => e.type === 'result') as { type: 'result'; reactionMs: number };
    expect(result.reactionMs).toBeGreaterThan(290);
    expect(result.reactionMs).toBeLessThan(320);
  });

  it('reacts to rotation as movement too', () => {
    const cueAt = 2.0;
    const s = new Scenario();
    s.run(4, (t) => {
      s.d.pushGyro(t >= cueAt + 0.25 ? 1.5 : 0);
      if (Math.abs(t - cueAt) < 0.5 / FS) s.d.signal(t);
    });
    const result = s.events.find((e) => e.type === 'result') as { type: 'result'; reactionMs: number };
    expect(result.reactionMs).toBeGreaterThan(240);
    expect(result.reactionMs).toBeLessThan(275);
  });

  it('times out when nobody moves after the cue', () => {
    const s = new Scenario();
    s.run(6, (t) => {
      if (Math.abs(t - 2) < 0.5 / FS) s.d.signal(t);
    });
    expect(s.events[s.events.length - 1]).toEqual({ type: 'timeout' });
  });

  it('only fires one decisive event per start', () => {
    const cueAt = 2.0;
    const s = new Scenario().moveWhen((t) => (t >= cueAt + 0.3 ? 0.5 : 0));
    s.run(6, (t) => {
      if (Math.abs(t - cueAt) < 0.5 / FS) s.d.signal(t);
    });
    expect(s.events.filter((e) => e.type !== 'ready')).toHaveLength(1);
  });

  it('adapts to a resting level other than exactly 1 g (tilted pocket)', () => {
    const d = new ReactionDetector();
    const events: ReactionEvent[] = [];
    for (let i = 0; i < 200; i++) {
      const e = d.pushAccel(i / FS, 0.93);
      if (e) events.push(e);
    }
    expect(events).toEqual([{ type: 'ready' }]);
  });
});

describe('start cue', () => {
  it('ends before the detector starts judging movement, so the buzz is never read as a start', () => {
    expect(CUE_MS).toBeLessThan(DEFAULT_REACTION_CONFIG.cueMaskS * 1000);
  });
});
