import { BalanceTracker } from '../balance';

const FS = 100;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Phone upright (gravity on y). `sway(t)` adds acceleration in g; `spike(t)` adds a jolt. */
function run(
  seconds: number,
  opts: {
    sway?: (t: number) => number;
    spike?: (t: number) => number;
    noise?: number;
    gyro?: number;
    config?: ConstructorParameters<typeof BalanceTracker>[0];
  } = {},
) {
  const tracker = new BalanceTracker(opts.config);
  const rnd = mulberry32(7);
  const noise = opts.noise ?? 0.002;
  const n = () => (rnd() - 0.5) * 2 * noise;
  for (let i = 0; i < seconds * FS && !tracker.done; i++) {
    const t = i / FS;
    tracker.pushGyro(opts.gyro ?? 0, 0, 0);
    tracker.pushAccel({
      t,
      x: (opts.sway?.(t) ?? 0) + (opts.spike?.(t) ?? 0) + n(),
      y: 1 + n(),
      z: n(),
    });
  }
  return tracker;
}

describe('BalanceTracker', () => {
  it('runs the full 20 s when the player stays up', () => {
    const t = run(25);
    const r = t.result();
    expect(t.done).toBe(true);
    expect(r.ended).toBe('time');
    expect(r.stoodSeconds).toBeCloseTo(20, 1);
  });

  it('reads only sensor noise as a very small sway', () => {
    const r = run(25).result();
    expect(r.swayMg).toBeLessThan(3);
  });

  it('measures sway amplitude as RMS (a 30 mg sine at 1.5 Hz is about 21 mg RMS)', () => {
    const r = run(25, { sway: (t) => 0.03 * Math.sin(2 * Math.PI * 1.5 * t) }).result();
    expect(r.swayMg).toBeGreaterThan(17);
    expect(r.swayMg).toBeLessThan(25);
  });

  it('reads a larger sway as larger', () => {
    const calm = run(25, { sway: (t) => 0.02 * Math.sin(2 * Math.PI * 1.2 * t) }).result();
    const shaky = run(25, { sway: (t) => 0.08 * Math.sin(2 * Math.PI * 1.2 * t) }).result();
    expect(shaky.swayMg).toBeGreaterThan(calm.swayMg * 2.5);
  });

  it('strongly attenuates a slow lean (a first-order filter removes most, not all, of it)', () => {
    // a 0.2 g, 0.05 Hz lean would be about 141 mg RMS unfiltered
    const r = run(25, { sway: (t) => 0.2 * Math.sin(2 * Math.PI * 0.05 * t) }).result();
    expect(r.swayMg).toBeLessThan(0.2 * 141);
  });

  it('stops when the free foot touches down and reports the time', () => {
    const r = run(25, { spike: (t) => (t >= 8 && t < 8.1 ? 1.2 : 0) }).result();
    expect(r.ended).toBe('touch');
    expect(r.stoodSeconds).toBeGreaterThan(7.9);
    expect(r.stoodSeconds).toBeLessThan(8.1);
  });

  it('does not count the stumble itself in the sway', () => {
    const r = run(25, { spike: (t) => (t >= 8 && t < 8.1 ? 1.2 : 0) }).result();
    expect(r.swayMg).toBeLessThan(5);
  });

  it('ignores the leg lift during the grace period', () => {
    const r = run(25, { spike: (t) => (t < 1.5 ? 0.9 * Math.sin(t * 20) : 0) }).result();
    expect(r.ended).toBe('time');
    expect(r.swayMg).toBeLessThan(5);
  });

  it('reports rotation in degrees per second', () => {
    const r = run(25, { gyro: 0.1 }).result();
    expect(r.gyroDps).toBeCloseTo((0.1 * 180) / Math.PI, 1);
  });

  it('gives a partial result for a run that has not finished', () => {
    const t = run(6);
    expect(t.done).toBe(false);
    const r = t.result();
    expect(r.stoodSeconds).toBeGreaterThan(5.5);
    expect(r.stoodSeconds).toBeLessThan(6.1);
  });
});
