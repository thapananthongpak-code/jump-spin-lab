import { ReactNode } from 'react';
import { JumpMeasurement } from '@/lib/jumpDetector';
import { Attempt, SportDef } from '@/lib/sports';
import { Player } from '@/lib/types';

/** Every sport's play component takes the same props, so the match screen can swap them freely. */
export interface CaptureProps {
  sport: SportDef;
  player: Player;
  /** bib shown in the header, e.g. "P2" */
  tag: string;
  /** lane colour of the player */
  accent: string;
  caption: string;
  rounds: { total: number; done: number };
  /** changing this sends the component back to idle (next player) */
  resetKey: string | number;
  /** called once per finished attempt; `raw` is the full jump measurement for jump sports */
  onAttempt: (a: Attempt, raw?: JumpMeasurement) => void;
  renderDone: (a: Attempt, retry: () => void) => ReactNode;
}
