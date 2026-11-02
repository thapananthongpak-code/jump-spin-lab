import { BalanceCapture } from './BalanceCapture';
import { JumpSportCapture } from './JumpSportCapture';
import { ReactionCapture } from './ReactionCapture';
import { ThrowCapture } from './ThrowCapture';
import { CaptureProps } from './types';
import { usesJumpDetector } from '@/lib/sports';

/** Picks the play component for the chosen sport. */
export function SportCapture(props: CaptureProps) {
  if (usesJumpDetector(props.sport.id)) return <JumpSportCapture {...props} />;
  switch (props.sport.id) {
    case 'reaction':
      return <ReactionCapture {...props} />;
    case 'throw':
      return <ThrowCapture {...props} />;
    case 'balance':
      return <BalanceCapture {...props} />;
    default:
      return null;
  }
}
