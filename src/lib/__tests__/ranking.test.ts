import { buildLeaderboard, QUALIFY_COUNT } from '../ranking';
import { JumpRow, Player } from '../types';

const player = (id: number, over: Partial<Player> = {}): Player => ({
  id,
  name: `P${id}`,
  heightCm: 170,
  weightKg: 70,
  age: 20,
  gender: 'male',
  ageGroup: '15-24',
  ...over,
});

let jid = 0;
const jump = (playerId: number, heightCm: number, spinDeg = 0): JumpRow => ({
  id: ++jid,
  playerId,
  heightCm,
  flightMs: 500,
  spinDeg,
  impactG: 3,
  deviceModel: null,
  createdAt: jid,
  matchId: null,
});

describe('buildLeaderboard', () => {
  it('scores the mean of the best 3 and ranks by it', () => {
    const players = [player(1), player(2)];
    const jumps = [
      jump(1, 50), jump(1, 40), jump(1, 30), jump(1, 10),
      jump(2, 45), jump(2, 44), jump(2, 43),
    ];
    const lb = buildLeaderboard(players, jumps, 'height');
    expect(lb.map((e) => e.player.id)).toEqual([2, 1]);
    expect(lb[0].score).toBeCloseTo(44);
    expect(lb[1].score).toBeCloseTo(40);
    expect(lb.map((e) => e.rank)).toEqual([1, 2]);
  });

  it('puts players with fewer than 3 jumps below the ranked ones, unranked', () => {
    const players = [player(1), player(2)];
    const jumps = [jump(1, 80), jump(1, 79), jump(2, 30), jump(2, 30), jump(2, 30)];
    const lb = buildLeaderboard(players, jumps, 'height');
    expect(QUALIFY_COUNT).toBe(3);
    expect(lb[0].player.id).toBe(2);
    expect(lb[1].player.id).toBe(1);
    expect(lb[1].rank).toBeNull();
    expect(lb[1].qualified).toBe(false);
  });

  it('gives tied scores the same rank', () => {
    const players = [player(1), player(2), player(3)];
    const jumps = [
      ...[40, 40, 40].map((h) => jump(1, h)),
      ...[40, 40, 40].map((h) => jump(2, h)),
      ...[30, 30, 30].map((h) => jump(3, h)),
    ];
    const lb = buildLeaderboard(players, jumps, 'height');
    expect(lb.map((e) => e.rank)).toEqual([1, 1, 3]);
  });

  it('filters by gender and age group', () => {
    const players = [
      player(1, { gender: 'female' }),
      player(2, { gender: 'male' }),
      player(3, { gender: 'female', ageGroup: '40+' }),
    ];
    const jumps = players.flatMap((p) => [jump(p.id, 40), jump(p.id, 40), jump(p.id, 40)]);
    expect(buildLeaderboard(players, jumps, 'height', { gender: 'female', ageGroup: 'all' })).toHaveLength(2);
    expect(buildLeaderboard(players, jumps, 'height', { gender: 'female', ageGroup: '40+' })).toHaveLength(1);
  });

  it('ranks by height relative to body height', () => {
    const players = [player(1, { heightCm: 200 }), player(2, { heightCm: 150 })];
    const jumps = [
      ...[50, 50, 50].map((h) => jump(1, h)), // 25 %
      ...[45, 45, 45].map((h) => jump(2, h)), // 30 %
    ];
    const lb = buildLeaderboard(players, jumps, 'relative');
    expect(lb[0].player.id).toBe(2);
  });

  it('ranks by spin', () => {
    const players = [player(1), player(2)];
    const jumps = [
      ...[90, 90, 90].map((s) => jump(1, 60, s)),
      ...[360, 340, 300].map((s) => jump(2, 30, s)),
    ];
    const lb = buildLeaderboard(players, jumps, 'spin');
    expect(lb[0].player.id).toBe(2);
  });
});

describe('score metric', () => {
  it('ranks by adjusted score, not raw height', () => {
    const players = [
      player(1, { gender: 'male', age: 22, weightKg: 70 }),
      player(2, { gender: 'female', age: 55, weightKg: 58, ageGroup: '40+' }),
    ];
    const jumps = [
      ...[38, 38, 38].map((h) => jump(1, h)),
      ...[30, 30, 30].map((h) => jump(2, h)),
    ];
    const byHeight = buildLeaderboard(players, jumps, 'height');
    const byScore = buildLeaderboard(players, jumps, 'score');
    expect(byHeight[0].player.id).toBe(1);
    expect(byScore[0].player.id).toBe(2);
  });
});

import { buildSportLeaderboard } from '../ranking';

describe('buildSportLeaderboard', () => {
  const mk = (playerId: number, values: number[]) => values.map((value) => ({ playerId, attempt: { value } }));

  it('ranks reaction times by points (lower ms = more points) and shows the best real attempt', () => {
    const players = [player(1), player(2)];
    const rows = [...mk(1, [320, 300, 310]), ...mk(2, [260, 270, 280])];
    const lb = buildSportLeaderboard('reaction', players, rows);
    expect(lb.map((e) => e.player.id)).toEqual([2, 1]);
    expect(lb[0].bestAttempt.value).toBe(260);
    expect(lb.map((e) => e.rank)).toEqual([1, 2]);
  });

  it('counts a false start as zero points', () => {
    const players = [player(1)];
    const rows = [
      { playerId: 1, attempt: { value: 0, foul: true } },
      { playerId: 1, attempt: { value: 0, foul: true } },
      { playerId: 1, attempt: { value: 300 } },
    ];
    const [e] = buildSportLeaderboard('reaction', players, rows);
    expect(e.score).toBeCloseTo(100 / 3, 0); // mean of 100, 0, 0
  });

  it('ranks once a player has played as many attempts as one match gives', () => {
    const players = [player(1), player(2)];
    const rows = [...mk(1, [300, 310, 320]), ...mk(2, [200])];
    const lb = buildSportLeaderboard('reaction', players, rows);
    expect(lb[0].player.id).toBe(1);
    expect(lb[0].qualified).toBe(true);
    expect(lb[1].qualified).toBe(false);
    expect(lb[1].rank).toBeNull();
  });

  it('respects the gender and age filters', () => {
    const players = [player(1, { gender: 'female' }), player(2, { gender: 'male' })];
    const rows = [...mk(1, [300, 300, 300]), ...mk(2, [300, 300, 300])];
    const lb = buildSportLeaderboard('reaction', players, rows, { gender: 'female', ageGroup: 'all' });
    expect(lb.map((e) => e.player.id)).toEqual([1]);
  });
});
