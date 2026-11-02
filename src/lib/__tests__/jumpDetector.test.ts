import {
  AccelSample,
  GyroSample,
  GRAVITY,
  JumpDetector,
  JumpResult,
  analyzeRecording,
  heightFromFlightTime,
} from '../jumpDetector';

const FS = 100;
const DT = 1 / FS;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Phase {
  ms: number;
  g: number;
  spin?: number; // rad/s about the vertical axis
}

/** Build a recording from consecutive phases; gravity points along +y of the phone. */
function build(phases: Phase[], noise = 0.03, seed = 1, startT = 0) {
  const rnd = mulberry32(seed);
  const n = () => (rnd() - 0.5) * 2 * noise;
  const accel: AccelSample[] = [];
  const gyro: GyroSample[] = [];
  let t = startT;
  for (const p of phases) {
    const steps = Math.round((p.ms / 1000) * FS);
    for (let i = 0; i < steps; i++) {
      accel.push({ t, x: n(), y: p.g + n(), z: n() });
      gyro.push({ t, x: n() * 0.1, y: (p.spin ?? 0) + n() * 0.1, z: n() * 0.1 });
      t += DT;
    }
  }
  return { accel, gyro };
}

const still = (ms: number): Phase => ({ ms, g: 1 });

function jump(flightMs: number, opts: { push?: number; impact?: number; spinDeg?: number } = {}) {
  const push = opts.push ?? 2.2;
  const impact = opts.impact ?? 3.5;
  const rate = opts.spinDeg ? ((opts.spinDeg * Math.PI) / 180) / (flightMs / 1000) : 0;
  return [
    still(800),
    { ms: 200, g: 0.7 },
    { ms: 150, g: push },
    { ms: flightMs, g: 0.05, spin: rate },
    { ms: 50, g: impact },
    { ms: 100, g: 1.6 },
    still(800),
  ];
}

describe('heightFromFlightTime', () => {
  it('matches h = g t^2 / 8', () => {
    expect(heightFromFlightTime(0.5)).toBeCloseTo(((GRAVITY * 0.25) / 8) * 100, 5);
    expect(heightFromFlightTime(0.5)).toBeCloseTo(30.6, 1);
  });
});

describe('JumpDetector', () => {
  it('measures a clean 500 ms jump', () => {
    const { accel, gyro } = build(jump(500));
    const results = analyzeRecording(accel, gyro);
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.flightMs).toBeGreaterThan(470);
    expect(r.flightMs).toBeLessThan(530);
    expect(r.heightCm).toBeGreaterThan(27);
    expect(r.heightCm).toBeLessThan(34);
    expect(r.impactG).toBeGreaterThan(3);
    expect(r.spinDeg).toBeLessThan(10);
  });

  it('measures body twist during flight', () => {
    const { accel, gyro } = build(jump(550, { spinDeg: 360 }));
    const [r] = analyzeRecording(accel, gyro);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spinDeg).toBeGreaterThan(330);
    expect(r.spinDeg).toBeLessThan(390);
  });

  it('detects spin regardless of rotation direction', () => {
    const { accel, gyro } = build(jump(550, { spinDeg: -180 }));
    const [r] = analyzeRecording(accel, gyro);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spinDeg).toBeGreaterThan(160);
    expect(r.spinDeg).toBeLessThan(200);
  });

  it('survives a gyroscope clock with a different time base', () => {
    const OFFSET = 100000;
    const { accel, gyro } = build(jump(550, { spinDeg: 360 }));
    const det = new JumpDetector();
    let gi = 0;
    let out: JumpResult | null = null;
    for (const a of accel) {
      // deliver gyro samples in real-time order, but stamped with another clock
      while (gi < gyro.length && gyro[gi].t <= a.t) {
        det.pushGyro({ ...gyro[gi], t: gyro[gi].t + OFFSET });
        gi++;
      }
      out = det.pushAccel(a) ?? out;
    }
    expect(out?.ok).toBe(true);
    if (!out || !out.ok) return;
    expect(out.spinDeg).toBeGreaterThan(330);
    expect(out.spinDeg).toBeLessThan(390);
  });

  it('counts two jumps separated by rest', () => {
    const a = build(jump(450), 0.03, 2);
    const lastT = a.accel[a.accel.length - 1].t + DT;
    const b = build(jump(600), 0.03, 3, lastT);
    const results = analyzeRecording([...a.accel, ...b.accel], [...a.gyro, ...b.gyro]);
    expect(results.filter((r) => r.ok)).toHaveLength(2);
  });

  it('rejects a short bump (too-short)', () => {
    const { accel, gyro } = build(jump(100));
    const [r] = analyzeRecording(accel, gyro);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('too-short');
  });

  it('rejects a flight without push-off (thrown phone)', () => {
    const phases = [still(1000), { ms: 500, g: 0.05 }, { ms: 50, g: 4 }, still(800)];
    const { accel, gyro } = build(phases);
    const [r] = analyzeRecording(accel, gyro);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('no-pushoff');
  });

  it('rejects a soft landing without impact', () => {
    const { accel, gyro } = build(jump(500, { impact: 1.1 }));
    const results = analyzeRecording(accel, gyro);
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('no-impact');
  });

  it('rejects an endless free fall (too-long)', () => {
    const phases = [still(1000), { ms: 150, g: 2.2 }, { ms: 1500, g: 0.05 }, still(500)];
    const { accel, gyro } = build(phases);
    const results = analyzeRecording(accel, gyro);
    expect(results[0].ok).toBe(false);
    if (results[0].ok) return;
    expect(results[0].reason).toBe('too-long');
  });

  it('ignores walking-like bumps and standing still', () => {
    const phases: Phase[] = [still(500)];
    for (let i = 0; i < 6; i++) phases.push({ ms: 250, g: 1.3 }, { ms: 250, g: 0.8 });
    phases.push(still(500));
    const { accel, gyro } = build(phases, 0.05);
    expect(analyzeRecording(accel, gyro)).toHaveLength(0);
  });

  it('reports a data gap instead of a wrong height', () => {
    const { accel, gyro } = build(jump(500));
    const startFlight = accel.findIndex((s) => Math.hypot(s.x, s.y, s.z) < 0.4);
    const gapped = accel.filter((_, i) => i < startFlight + 10 || i > startFlight + 30);
    const results = analyzeRecording(gapped, gyro);
    const r = results[0];
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('data-gap');
  });

  it('is tolerant to sensor noise', () => {
    for (let seed = 10; seed < 20; seed++) {
      const { accel, gyro } = build(jump(520), 0.08, seed);
      const results = analyzeRecording(accel, gyro);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
    }
  });
});
