import { useEffect, useRef, useState } from 'react';
import { speak, tick, warn } from '@/lib/feedback';

/**
 * Counts `seconds` down to 0 once per second while `running`, with a tick on every number and a
 * stronger buzz at the end. `onEnd` fires when it reaches 0.
 */
export function useCountdown(
  running: boolean,
  seconds: number,
  onEnd: () => void,
  opts: { intro?: string; outro?: string; onTick?: (remaining: number) => void } = {},
): number {
  const [count, setCount] = useState(seconds);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!running) return;
    setCount(seconds);
    if (optsRef.current.intro) speak(optsRef.current.intro);
    optsRef.current.onTick?.(seconds);
    let n = seconds;
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        warn();
        if (optsRef.current.outro) speak(optsRef.current.outro);
        endRef.current();
      } else {
        tick();
        setCount(n);
        optsRef.current.onTick?.(n);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, seconds]);

  return count;
}
