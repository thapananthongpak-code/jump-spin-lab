import { SPORT_LIST } from '../sports';
import { DEMOS, frameAt, GROUND_Y, SEG, solve, solveJoint } from '../technique';

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('technique demos', () => {
  it('has a demo for every sport', () => {
    for (const sport of SPORT_LIST) expect(DEMOS[sport.id]).toBeDefined();
  });

  it('has keys in time order, inside the loop, each pointing at a real caption', () => {
    for (const demo of Object.values(DEMOS)) {
      demo.keys.forEach((k, i) => {
        if (i > 0) expect(k.at).toBeGreaterThanOrEqual(demo.keys[i - 1].at);
        expect(k.at).toBeLessThanOrEqual(demo.duration);
        expect(demo.steps[k.step]).toBeDefined();
      });
      // every caption is shown at some point
      expect(new Set(demo.keys.map((k) => k.step)).size).toBe(demo.steps.length);
    }
  });

  it('never stretches a limb or sinks a foot into the ground', () => {
    for (const demo of Object.values(DEMOS)) {
      for (let t = 0; t < demo.duration; t += 0.05) {
        const s = solve(frameAt(demo, t).pose, demo.phone);
        expect(dist(s.hip, s.kneeF)).toBeCloseTo(SEG.thigh, 3);
        expect(dist(s.kneeF, s.footF)).toBeCloseTo(SEG.shin, 3);
        expect(dist(s.shoulder, s.elbowF)).toBeCloseTo(SEG.upperArm, 3);
        expect(dist(s.elbowF, s.handF)).toBeCloseTo(SEG.forearm, 3);
        expect(s.footF[1]).toBeLessThanOrEqual(GROUND_Y + 2);
        expect(s.footB[1]).toBeLessThanOrEqual(GROUND_Y + 2);
        expect(Number.isFinite(s.phone.at[0]) && Number.isFinite(s.phone.at[1])).toBe(true);
      }
    }
  });

  it('bends knees forward and lets the pose choose the elbow side', () => {
    const knee = solveJoint([0, 0], [0, 60], 42, 42, -1).mid;
    expect(knee[0]).toBeGreaterThan(0);
    const elbow = solveJoint([0, 0], [0, 50], 30, 30, 1).mid;
    expect(elbow[0]).toBeLessThan(0);
  });

  it('puts the phone on the forearm for the throw and in the pocket otherwise', () => {
    expect(DEMOS.throw.phone).toBe('forearm');
    for (const id of ['height', 'spin', 'reaction', 'balance'] as const) expect(DEMOS[id].phone).toBe('pocket');
  });
});
