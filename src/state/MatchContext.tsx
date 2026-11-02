import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Attempt } from '@/lib/sports';
import { MatchMode, Player } from '@/lib/types';

export interface Slot {
  player: Player | null;
  /** the player's best saved height before this match, to spot a new personal best */
  previousBestCm: number;
  attempts: Attempt[];
}

export interface ActiveMatch {
  matchId: number;
  mode: MatchMode;
  slots: Slot[];
  /** index of the player whose turn it is */
  current: number;
}

interface MatchContextValue {
  match: ActiveMatch | null;
  start: (input: { matchId: number; mode: MatchMode; playerCount: number }) => void;
  setPlayer: (slot: number, player: Player, previousBestCm: number) => void;
  addAttempt: (slot: number, attempt: Attempt) => void;
  next: () => void;
  clear: () => void;
}

const MatchContext = createContext<MatchContextValue | null>(null);

export function MatchProvider({ children }: { children: ReactNode }) {
  const [match, setMatch] = useState<ActiveMatch | null>(null);

  const start = useCallback<MatchContextValue['start']>(({ matchId, mode, playerCount }) => {
    setMatch({
      matchId,
      mode,
      current: 0,
      slots: Array.from({ length: playerCount }, () => ({ player: null, previousBestCm: 0, attempts: [] })),
    });
  }, []);

  const setPlayer = useCallback<MatchContextValue['setPlayer']>((slot, player, previousBestCm) => {
    setMatch((m) =>
      m ? { ...m, slots: m.slots.map((s, i) => (i === slot ? { ...s, player, previousBestCm } : s)) } : m,
    );
  }, []);

  const addAttempt = useCallback<MatchContextValue['addAttempt']>((slot, attempt) => {
    setMatch((m) =>
      m
        ? { ...m, slots: m.slots.map((s, i) => (i === slot ? { ...s, attempts: [...s.attempts, attempt] } : s)) }
        : m,
    );
  }, []);

  const next = useCallback(() => {
    setMatch((m) => (m && m.current < m.slots.length - 1 ? { ...m, current: m.current + 1 } : m));
  }, []);

  const clear = useCallback(() => setMatch(null), []);

  const value = useMemo(
    () => ({ match, start, setPlayer, addAttempt, next, clear }),
    [match, start, setPlayer, addAttempt, next, clear],
  );
  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>;
}

export function useMatch(): MatchContextValue {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error('useMatch must be used inside MatchProvider');
  return ctx;
}
