import {
  REFERENCE,
  ageFactor,
  heightScore,
  peakPowerW,
  relativePower,
  sexFactor,
  spinScore,
} from '../scoring';

const man = { weightKg: 70, age: 22, gender: 'male' as const };

describe('peak power (Sayers 1999)', () => {
  it('matches the published equation', () => {
    expect(peakPowerW(40, 70)).toBeCloseTo(60.7 * 40 + 45.3 * 70 - 2055, 6);
  });

  it('never goes negative', () => {
    expect(peakPowerW(0, 20)).toBe(0);
  });
});

describe('heightScore', () => {
  it('gives the reference person exactly 100', () => {
    const p = { weightKg: REFERENCE.massKg, age: 25, gender: 'male' as const };
    expect(heightScore(REFERENCE.heightCm, p)).toBeCloseTo(100, 6);
  });

  it('rises with jump height', () => {
    expect(heightScore(50, man)).toBeGreaterThan(heightScore(40, man));
  });

  it('is higher for the heavier person who jumps the same height', () => {
    const heavy = { ...man, weightKg: 90 };
    const light = { ...man, weightKg: 55 };
    expect(heightScore(45, heavy)).toBeGreaterThan(heightScore(45, light));
  });

  it('is not hugely sensitive to body size (allometric scaling)', () => {
    const heavy = { ...man, weightKg: 90 };
    const light = { ...man, weightKg: 55 };
    expect(heightScore(45, heavy) / heightScore(45, light)).toBeLessThan(1.15);
  });

  it('lets an older or female player score the same as a young man with a lower jump', () => {
    const woman = { weightKg: 58, age: 22, gender: 'female' as const };
    const elder = { weightKg: 70, age: 60, gender: 'male' as const };
    expect(heightScore(32, woman)).toBeGreaterThan(heightScore(32, man));
    expect(heightScore(28, elder)).toBeGreaterThan(heightScore(28, man));
  });

  it('puts a typical young woman near 100 at a typical jump', () => {
    const woman = { weightKg: 58, age: 22, gender: 'female' as const };
    const s = heightScore(30, woman);
    expect(s).toBeGreaterThan(85);
    expect(s).toBeLessThan(110);
  });
});

describe('ageFactor / sexFactor', () => {
  it('is 1 for young adults, falls with age and is lower for children', () => {
    expect(ageFactor(20)).toBe(1);
    expect(ageFactor(25)).toBe(1);
    expect(ageFactor(45)).toBeLessThan(1);
    expect(ageFactor(65)).toBeLessThan(ageFactor(45));
    expect(ageFactor(10)).toBeLessThan(1);
  });

  it('interpolates linearly and clamps outside the table', () => {
    expect(ageFactor(35)).toBeCloseTo(0.9 + (1 - 0.9) * (40 - 35) / (40 - 29), 6);
    expect(ageFactor(2)).toBe(ageFactor(6));
    expect(ageFactor(120)).toBe(ageFactor(90));
  });

  it('uses lower expectation for women', () => {
    expect(sexFactor('female')).toBeLessThan(sexFactor('male'));
  });
});

describe('spinScore', () => {
  it('gives 100 for a full turn at the reference age', () => {
    expect(spinScore(360, { age: 25 })).toBeCloseTo(100, 6);
  });

  it('credits older players a little more for the same degrees', () => {
    expect(spinScore(180, { age: 60 })).toBeGreaterThan(spinScore(180, { age: 25 }));
  });
});

describe('relativePower', () => {
  it('is power divided by mass^0.67', () => {
    expect(relativePower(40, 70)).toBeCloseTo(peakPowerW(40, 70) / Math.pow(70, 0.67), 6);
  });
});

import {
  BALANCE_SECONDS,
  REACTION_REF_MS,
  balanceExpectedSwayMg,
  balanceScore,
  lerpTable,
  reactionExpectedMs,
  reactionScore,
  THROW_REF_KMH,
  throwScore,
} from '../scoring';

describe('lerpTable', () => {
  const t: [number, number][] = [[0, 0], [10, 100]];
  it('interpolates and clamps', () => {
    expect(lerpTable(t, 5)).toBe(50);
    expect(lerpTable(t, -3)).toBe(0);
    expect(lerpTable(t, 99)).toBe(100);
  });
});

describe('reactionScore', () => {
  it('gives 100 at the reference time for a young adult', () => {
    expect(reactionScore(REACTION_REF_MS, false, { age: 25 })).toBe(100);
  });
  it('is higher for faster reactions and zero for a false start', () => {
    expect(reactionScore(200, false, { age: 25 })).toBeGreaterThan(reactionScore(300, false, { age: 25 }));
    expect(reactionScore(250, true, { age: 25 })).toBe(0);
  });
  it('expects slower times from children and older people', () => {
    expect(reactionExpectedMs(10)).toBeGreaterThan(reactionExpectedMs(25));
    expect(reactionExpectedMs(70)).toBeGreaterThan(reactionExpectedMs(25));
  });
});

describe('balanceScore', () => {
  it('gives 100 for a full run at the reference sway', () => {
    expect(balanceScore(BALANCE_SECONDS, balanceExpectedSwayMg(25), { age: 25 })).toBe(100);
  });
  it('drops with a shorter time and with more sway', () => {
    const full = balanceScore(BALANCE_SECONDS, 20, { age: 25 });
    expect(balanceScore(10, 20, { age: 25 })).toBeCloseTo(full / 2, 0);
    expect(balanceScore(BALANCE_SECONDS, 40, { age: 25 })).toBeCloseTo(full / 2, 0);
  });
  it('caps at 150 and survives a zero reading', () => {
    expect(balanceScore(BALANCE_SECONDS, 0, { age: 25 })).toBe(150);
    expect(balanceScore(BALANCE_SECONDS, 1, { age: 25 })).toBe(150);
  });
  it('does not let a short, very still run beat a full, average one', () => {
    expect(balanceScore(6, 5, { age: 25 })).toBeLessThan(balanceScore(BALANCE_SECONDS, 40, { age: 25 }));
  });
  it('expects more sway from older people', () => {
    expect(balanceExpectedSwayMg(70)).toBeGreaterThan(balanceExpectedSwayMg(25));
  });
});

describe('throwScore', () => {
  it('gives 100 at the reference speed for a young man', () => {
    expect(throwScore(THROW_REF_KMH, { age: 25, gender: 'male' })).toBe(100);
  });
  it('expects less speed from women and older people', () => {
    expect(throwScore(40, { age: 25, gender: 'female' })).toBeGreaterThan(throwScore(40, { age: 25, gender: 'male' }));
    expect(throwScore(40, { age: 65, gender: 'male' })).toBeGreaterThan(throwScore(40, { age: 25, gender: 'male' }));
  });
});
