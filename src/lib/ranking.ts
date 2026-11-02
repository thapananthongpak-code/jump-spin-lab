import { heightScore } from './scoring';
import { Attempt, SPORTS } from './sports';
import { AgeGroup, Gender, JumpRow, Player, SportId } from './types';

export type Metric = 'score' | 'height' | 'spin' | 'relative';

/** A player is ranked only after this many jumps; score = mean of their best N. */
export const QUALIFY_COUNT = 3;

export interface LeaderboardFilter {
  gender: Gender | 'all';
  ageGroup: AgeGroup | 'all';
}

export interface LeaderboardEntry {
  player: Player;
  jumps: number;
  best: number;
  score: number;
  qualified: boolean;
  rank: number | null;
}

export function metricValue(jump: JumpRow, player: Player, metric: Metric): number {
  switch (metric) {
    case 'score':
      return heightScore(jump.heightCm, player);
    case 'height':
      return jump.heightCm;
    case 'spin':
      return jump.spinDeg;
    case 'relative':
      return player.heightCm > 0 ? (jump.heightCm / player.heightCm) * 100 : 0;
  }
}

export function metricUnit(metric: Metric): string {
  switch (metric) {
    case 'score':
      return 'pts';
    case 'height':
      return 'cm';
    case 'spin':
      return '°';
    case 'relative':
      return '% of height';
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildLeaderboard(
  players: Player[],
  jumps: JumpRow[],
  metric: Metric,
  filter: LeaderboardFilter = { gender: 'all', ageGroup: 'all' },
): LeaderboardEntry[] {
  const byPlayer = new Map<number, number[]>();
  const playerById = new Map(players.map((p) => [p.id, p]));
  for (const j of jumps) {
    const p = playerById.get(j.playerId);
    if (!p) continue;
    const list = byPlayer.get(p.id) ?? [];
    list.push(metricValue(j, p, metric));
    byPlayer.set(p.id, list);
  }

  const entries: LeaderboardEntry[] = [];
  for (const p of players) {
    if (filter.gender !== 'all' && p.gender !== filter.gender) continue;
    if (filter.ageGroup !== 'all' && p.ageGroup !== filter.ageGroup) continue;
    const values = (byPlayer.get(p.id) ?? []).slice().sort((a, b) => b - a);
    if (values.length === 0) continue;
    const top = values.slice(0, QUALIFY_COUNT);
    const score = top.reduce((a, b) => a + b, 0) / top.length;
    entries.push({
      player: p,
      jumps: values.length,
      best: values[0],
      score,
      qualified: values.length >= QUALIFY_COUNT,
      rank: null,
    });
  }

  const qualified = entries
    .filter((e) => e.qualified)
    .sort((a, b) => round1(b.score) - round1(a.score) || b.best - a.best);
  let rank = 0;
  let prevScore: number | null = null;
  qualified.forEach((e, i) => {
    const s = round1(e.score);
    if (prevScore === null || s !== prevScore) rank = i + 1;
    e.rank = rank;
    prevScore = s;
  });

  const unqualified = entries.filter((e) => !e.qualified).sort((a, b) => b.best - a.best);
  return [...qualified, ...unqualified];
}

export interface SportEntry {
  player: Player;
  count: number;
  bestAttempt: Attempt;
  /** mean of the best QUALIFY_COUNT scores */
  score: number;
  qualified: boolean;
  rank: number | null;
}

/**
 * Leaderboard for one sport from saved attempts. Same rule as the jump leaderboard: the score
 * is the mean of the best few attempts' points, and a player is ranked once they have at least
 * as many attempts as one match gives (at most QUALIFY_COUNT).
 */
export function buildSportLeaderboard(
  sport: SportId,
  players: Player[],
  rows: { playerId: number; attempt: Attempt }[],
  filter: LeaderboardFilter = { gender: 'all', ageGroup: 'all' },
): SportEntry[] {
  const def = SPORTS[sport];
  const need = Math.min(QUALIFY_COUNT, def.rounds);
  const byPlayer = new Map<number, { attempt: Attempt; score: number }[]>();
  const playerById = new Map(players.map((p) => [p.id, p]));
  for (const r of rows) {
    const p = playerById.get(r.playerId);
    if (!p) continue;
    const list = byPlayer.get(p.id) ?? [];
    list.push({ attempt: r.attempt, score: def.score(r.attempt, p) });
    byPlayer.set(p.id, list);
  }

  const entries: SportEntry[] = [];
  for (const p of players) {
    if (filter.gender !== 'all' && p.gender !== filter.gender) continue;
    if (filter.ageGroup !== 'all' && p.ageGroup !== filter.ageGroup) continue;
    const list = (byPlayer.get(p.id) ?? []).slice().sort((a, b) => b.score - a.score);
    if (list.length === 0) continue;
    const top = list.slice(0, QUALIFY_COUNT);
    entries.push({
      player: p,
      count: list.length,
      bestAttempt: list[0].attempt,
      score: top.reduce((a, b) => a + b.score, 0) / top.length,
      qualified: list.length >= need,
      rank: null,
    });
  }

  const qualified = entries.filter((e) => e.qualified).sort((a, b) => round1(b.score) - round1(a.score));
  let rank = 0;
  let prev: number | null = null;
  qualified.forEach((e, i) => {
    const s = round1(e.score);
    if (prev === null || s !== prev) rank = i + 1;
    e.rank = rank;
    prev = s;
  });
  const unqualified = entries.filter((e) => !e.qualified).sort((a, b) => b.score - a.score);
  return [...qualified, ...unqualified];
}
