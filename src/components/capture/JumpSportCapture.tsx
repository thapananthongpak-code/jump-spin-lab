import { JumpCapture } from '../JumpCapture';
import { JumpMeasurement } from '@/lib/jumpDetector';
import { Attempt } from '@/lib/sports';
import { CaptureProps } from './types';

const toAttempt = (m: JumpMeasurement): Attempt => ({ value: m.heightCm, value2: m.spinDeg });

/** height / spin / combo: the jump detector, shown through the shared capture interface. */
export function JumpSportCapture({ sport, player, tag, accent, caption, rounds, resetKey, onAttempt, renderDone }: CaptureProps) {
  return (
    <JumpCapture
      playerName={player.name}
      caption={caption}
      tag={tag}
      accent={accent}
      rounds={rounds}
      resetKey={resetKey}
      scoreFor={(m) => sport.score(toAttempt(m), player)}
      onMeasured={(m) => onAttempt(toAttempt(m), m)}
      renderDone={(m, retry) => renderDone(toAttempt(m), retry)}
      demo={sport.id}
    />
  );
}
