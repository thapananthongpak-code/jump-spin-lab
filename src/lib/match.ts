import { Attempt, SPORTS } from './sports';
import { Player, SportId } from './types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export interface PlayerResult {
  player: Player;
  attempts: Attempt[];
}

export interface Standing {
  player: Player;
  attempts: Attempt[];
  /** score of each attempt, same order as attempts */
  scores: number[];
  /** the best attempt (by score) -- measured values are shown as they were measured */
  bestAttempt: Attempt | null;
  bestScore: number;
  meanScore: number;
  rank: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Final score = best attempt (as in athletics). Ties are broken by the mean score of all
 * attempts; players still tied share a rank. Works for every sport: it only needs the score.
 */
export function rankMatch(sport: SportId, results: PlayerResult[]): Standing[] {
  const def = SPORTS[sport];
  const standings: Standing[] = results.map(({ player, attempts }) => {
    const scores = attempts.map((a) => def.score(a, player));
    let bestIdx = -1;
    scores.forEach((s, i) => {
      if (bestIdx < 0 || s > scores[bestIdx]) bestIdx = i;
    });
    return {
      player,
      attempts,
      scores,
      bestAttempt: bestIdx >= 0 ? attempts[bestIdx] : null,
      bestScore: bestIdx >= 0 ? scores[bestIdx] : 0,
      meanScore: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      rank: 0,
    };
  });

  const compare = (a: Standing, b: Standing) =>
    b.bestScore - a.bestScore || b.meanScore - a.meanScore;

  standings.sort(compare);
  standings.forEach((s, i) => {
    s.rank = i > 0 && compare(standings[i - 1], s) === 0 ? standings[i - 1].rank : i + 1;
  });
  return standings;
}
