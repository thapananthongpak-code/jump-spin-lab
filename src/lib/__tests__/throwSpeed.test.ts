import { ThrowEvent, ThrowTracker } from '../throwSpeed';

const FS = 100;
const G = 9.81;

type M = number[]; // row-major 3x3
const mul = (a: M, b: M): M =>
  [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j]));
const apply = (m: M, v: number[]) => [0, 1, 2].map((i) => m[3 * i] * v[0] + m[3 * i + 1] * v[1] + m[3 * i + 2] * v[2]);
const transpose = (m: M): M => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const rotY = (t: number): M => [Math.cos(t), 0, Math.sin(t), 0, 1, 0, -Math.sin(t), 0, Math.cos(t)];
const rotX = (t: number): M => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
const rotZ = (t: number): M => [Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t), 0, 0, 0, 1];

/**
 * A phone on a rigid arm of length `r` swinging about the shoulder (body y axis). The arm is
 * still for `restS`, swings with a smooth rate bump peaking at `peak` rad/s over `T` seconds,
 * then stops. `pose` is how the whole setup is tilted relative to gravity.
 */
function simulate(opts: {
  r?: number;
  peak: number;
  T?: number;
  restS?: number;
  pose?: M;
  /** iOS reports the accelerometer with the opposite sign */
  flipAccel?: boolean;
  noise?: number;
  clipG?: number;
}) {
  const { r = 0.5, peak, T = 0.4, restS = 1, pose = rotX(0), flipAccel = false, noise = 0, clipG = Infinity } = opts;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  const rate = (t: number) => {
    const u = t - restS;
    return u > 0 && u < T ? peak * Math.sin((Math.PI * u) / T) ** 2 : 0;
  };
  const angle = (t: number) => {
    const u = Math.min(Math.max(t - restS, 0), T);
    return peak * (u / 2 - (T / (4 * Math.PI)) * Math.sin((2 * Math.PI * u) / T));
  };
  const body = (t: number) => mul(pose, rotY(angle(t)));
  const pos = (t: number) => apply(body(t), [r, 0, 0]);

  const tracker = new ThrowTracker();
  const events: ThrowEvent[] = [];
  const h = 1e-4;
  const total = restS + T + 1;
  for (let i = 0; i <= total * FS; i++) {
    const t = i / FS;
    const p0 = pos(t - h);
    const p1 = pos(t);
    const p2 = pos(t + h);
    const accW = [0, 1, 2].map((k) => (p2[k] - 2 * p1[k] + p0[k]) / (h * h));
    // specific force = acceleration minus gravity (gravity points down, -z)
    const fW = [accW[0], accW[1], accW[2] + G];
    let f = apply(transpose(body(t)), fW).map((c) => c / G + noise * rnd());
    if (flipAccel) f = f.map((c) => -c);
    f = f.map((c) => Math.max(-clipG, Math.min(clipG, c)));
    tracker.pushGyro({ t, x: noise * rnd(), y: rate(t) + noise * rnd(), z: noise * rnd() });
    const e = tracker.pushAccel({ t, x: f[0], y: f[1], z: f[2] });
    if (e) events.push(e);
  }
  return { events, trueKmh: peak * r * 3.6 };
}

const resultOf = (events: ThrowEvent[]) => events.find((e) => e.type === 'result') as
  | Extract<ThrowEvent, { type: 'result' }>
  | undefined;

describe('ThrowTracker', () => {
  it('becomes ready after the player holds still', () => {
    const { events } = simulate({ peak: 0, restS: 1 });
    expect(events).toEqual([{ type: 'ready' }]);
  });

  it('measures the arm speed of a swing', () => {
    const { events, trueKmh } = simulate({ peak: 12 });
    const r = resultOf(events);
    expect(r).toBeDefined();
    expect(r!.kmh).toBeCloseTo(trueKmh, -0.5); // within ~1.5 km/h of 21.6
    expect(Math.abs(r!.kmh - trueKmh) / trueKmh).toBeLessThan(0.05);
    expect(r!.clipped).toBe(false);
  });

  it('gives the same speed whatever way the phone is strapped on', () => {
    for (const pose of [rotX(0.7), mul(rotZ(1.2), rotX(-0.4)), rotX(Math.PI / 2)]) {
      const { events, trueKmh } = simulate({ peak: 12, pose });
      const r = resultOf(events);
      expect(r).toBeDefined();
      expect(Math.abs(r!.kmh - trueKmh) / trueKmh).toBeLessThan(0.05);
    }
  });

  it('works with the accelerometer sign used on iOS', () => {
    const { events, trueKmh } = simulate({ peak: 12, flipAccel: true, pose: rotX(0.5) });
    expect(Math.abs(resultOf(events)!.kmh - trueKmh) / trueKmh).toBeLessThan(0.05);
  });

  it('stays close with sensor noise', () => {
    const { events, trueKmh } = simulate({ peak: 12, noise: 0.02 });
    expect(Math.abs(resultOf(events)!.kmh - trueKmh) / trueKmh).toBeLessThan(0.1);
  });

  it('does not count a gentle arm movement as a throw', () => {
    const { events } = simulate({ peak: 4, T: 0.6 });
    expect(events.some((e) => e.type === 'result')).toBe(false);
  });

  it('flags a throw that went past the sensor range', () => {
    const { events } = simulate({ peak: 25, clipG: 8 });
    expect(resultOf(events)?.clipped).toBe(true);
  });
});
