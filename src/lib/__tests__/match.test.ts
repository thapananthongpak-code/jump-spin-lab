import { rankMatch } from '../match';
import { Attempt, SPORTS, SPORT_LIST, usesJumpDetector } from '../sports';
import { Player } from '../types';

const player = (id: number, over: Partial<Player> = {}): Player => ({
  id,
  name: `P${id}`,
  heightCm: 170,
  weightKg: 70,
  age: 22,
  gender: 'male',
  ageGroup: '15-24',
  ...over,
});

const j = (heightCm: number, spinDeg = 0): Attempt => ({ value: heightCm, value2: spinDeg });

describe('rankMatch (jump sports)', () => {
  it('takes the best round as the final score', () => {
    const [a] = rankMatch('height', [{ player: player(1), attempts: [j(30), j(45), j(40)] }]);
    expect(a.bestAttempt).toEqual(j(45));
    expect(a.scores).toHaveLength(3);
    expect(a.bestScore).toBe(Math.max(...a.scores));
  });

  it('ranks by score and keeps measured values untouched', () => {
    const s = rankMatch('height', [
      { player: player(1), attempts: [j(40), j(41), j(39)] },
      { player: player(2), attempts: [j(44), j(30), j(35)] },
    ]);
    expect(s.map((x) => x.player.id)).toEqual([2, 1]);
    expect(s[0].bestAttempt?.value).toBe(44);
  });

  it('can rank a lower measured jump higher because of the adjustment', () => {
    const woman = player(1, { gender: 'female', age: 60, weightKg: 55 });
    const man = player(2, { gender: 'male', age: 22, weightKg: 75 });
    const s = rankMatch('height', [
      { player: woman, attempts: [j(26), j(25), j(24)] },
      { player: man, attempts: [j(35), j(34), j(33)] },
    ]);
    expect(s[0].player.id).toBe(1);
    expect(s[0].bestAttempt?.value).toBe(26);
  });

  it('breaks ties on the mean of all rounds', () => {
    const s = rankMatch('height', [
      { player: player(1), attempts: [j(40), j(30), j(30)] },
      { player: player(2), attempts: [j(40), j(38), j(36)] },
    ]);
    expect(s.map((x) => x.player.id)).toEqual([2, 1]);
    expect(s.map((x) => x.rank)).toEqual([1, 2]);
  });

  it('shares a rank when everything is identical', () => {
    const s = rankMatch('height', [
      { player: player(1), attempts: [j(40), j(40), j(40)] },
      { player: player(2), attempts: [j(40), j(40), j(40)] },
    ]);
    expect(s.map((x) => x.rank)).toEqual([1, 1]);
  });

  it('ranks the spin event by degrees', () => {
    const s = rankMatch('spin', [
      { player: player(1), attempts: [j(60, 90), j(60, 120), j(60, 100)] },
      { player: player(2), attempts: [j(20, 340), j(20, 200), j(20, 250)] },
    ]);
    expect(s[0].player.id).toBe(2);
  });

  it('puts a player with no attempts last', () => {
    const s = rankMatch('height', [
      { player: player(1), attempts: [] },
      { player: player(2), attempts: [j(20)] },
    ]);
    expect(s.map((x) => x.player.id)).toEqual([2, 1]);
  });
});

describe('rankMatch (other sports)', () => {
  it('ranks reaction by the lowest time and gives a false start zero', () => {
    const s = rankMatch('reaction', [
      { player: player(1), attempts: [{ value: 280 }, { value: 310 }, { value: 295 }] },
      { player: player(2), attempts: [{ value: 0, foul: true }, { value: 350 }, { value: 330 }] },
      { player: player(3), attempts: [{ value: 0, foul: true }, { value: 0, foul: true }, { value: 0, foul: true }] },
    ]);
    expect(s.map((x) => x.player.id)).toEqual([1, 2, 3]);
    expect(s[2].bestScore).toBe(0);
    expect(SPORTS.reaction.format({ value: 0, foul: true }).main).toBe('FS');
  });

  it('corrects reaction time for age', () => {
    const young = player(1, { age: 22 });
    const old = player(2, { age: 70 });
    // the 70-year-old is slower in milliseconds but scores the same or better
    expect(SPORTS.reaction.score({ value: 380 }, old)).toBeGreaterThan(SPORTS.reaction.score({ value: 380 }, young));
  });

  it('ranks balance by time and steadiness', () => {
    const s = rankMatch('balance', [
      { player: player(1), attempts: [{ value: 20, value2: 40 }] },
      { player: player(2), attempts: [{ value: 20, value2: 15 }] },
      { player: player(3), attempts: [{ value: 6, value2: 10 }] },
    ]);
    expect(s.map((x) => x.player.id)).toEqual([2, 1, 3]);
  });
});

describe('sports registry', () => {
  it('lists every sport once with a positive number of rounds', () => {
    expect(SPORT_LIST).toHaveLength(5);
    expect(new Set(SPORT_LIST.map((x) => x.id)).size).toBe(5);
    for (const sport of SPORT_LIST) {
      expect(sport.rounds).toBeGreaterThan(0);
      expect(sport.placement.length).toBeGreaterThan(0);
    }
  });

  it('only height / spin use the jump detector', () => {
    expect(SPORT_LIST.filter((x) => usesJumpDetector(x.id)).map((x) => x.id)).toEqual(['height', 'spin']);
  });

  it('formats measured values as measured', () => {
    expect(SPORTS.height.format({ value: 45.34 }).main).toBe('45.3');
    expect(SPORTS.spin.format({ value: 30, value2: 359.6 }).main).toBe('360°');
    expect(SPORTS.reaction.format({ value: 287.4 }).main).toBe('287');
    expect(SPORTS.throw.format({ value: 48.26 }).main).toBe('48.3');
    expect(SPORTS.balance.format({ value: 12.34, value2: 18.2 })).toEqual({ main: '12.3', sub: '18mg' });
  });
});
