import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSensorStatus } from '@/hooks/useSensorStatus';
import { useSensorStream } from '@/hooks/useSensorStream';
import { speak, stopSpeaking, success, tick, warn } from '@/lib/feedback';
import { throwExpectedKmh } from '@/lib/scoring';
import { ThrowEvent, ThrowTracker } from '@/lib/throwSpeed';
import { colors, fonts, space } from '@/theme/theme';
import { Body, Button } from '../ui';
import { TechniqueDemo } from '../TechniqueDemo';
import { CaptureFrame, IdlePanel, ResultBoard, SensorProblem, Stage } from './parts';
import { CaptureProps } from './types';

type Phase = 'idle' | 'settling' | 'ready' | 'done';

interface Result {
  kmh: number;
  peakAccelG: number;
  clipped: boolean;
}

export function ThrowCapture({ sport, player, tag, accent, caption, rounds, resetKey, onAttempt, renderDone }: CaptureProps) {
  const status = useSensorStatus(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const tracker = useRef(new ThrowTracker());
  const onAttemptRef = useRef(onAttempt);
  onAttemptRef.current = onAttempt;

  const reset = () => {
    stopSpeaking();
    setPhase('idle');
    setResult(null);
  };
  useEffect(reset, [resetKey]);

  const handle = (e: ThrowEvent) => {
    switch (e.type) {
      case 'ready':
        tick();
        speak('Throw!');
        setPhase('ready');
        return;
      case 'too-weak':
        warn();
        setNotice("That didn't look like a full throw, so it does not count. Try again and throw harder.");
        setPhase('idle');
        return;
      case 'glitch':
        warn();
        setNotice('The sensor reading was not believable (did the phone slip?). This round does not count.');
        setPhase('idle');
        return;
      case 'result': {
        success();
        speak(`${Math.round(e.kmh)} kilometers per hour`);
        setResult(e);
        setPhase('done');
        onAttemptRef.current({ value: e.kmh });
        return;
      }
    }
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useSensorStream({
    status,
    active: phase === 'settling' || phase === 'ready',
    onAccel: (s) => {
      const e = tracker.current.pushAccel(s);
      if (e) handleRef.current(e);
    },
    onGyro: (g) => tracker.current.pushGyro(g),
  });

  const start = () => {
    tracker.current = new ThrowTracker();
    setNotice(null);
    setPhase('settling');
    speak('Get ready and hold still');
  };

  const frame = { player, caption, tag, accent, rounds };

  if (status === 'unavailable' || status === 'denied') {
    return (
      <CaptureFrame {...frame}>
        <SensorProblem status={status} gyro />
      </CaptureFrame>
    );
  }

  if (phase === 'done' && result) {
    const attempt = { value: result.kmh };
    return (
      <CaptureFrame {...frame}>
        <ResultBoard
          accent={accent}
          label="ARM SPEED"
          value={result.kmh}
          decimals={1}
          unit="km/h"
          points={sport.score(attempt, player)}
        >
          <Body style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}>
            Peak acceleration {result.peakAccelG.toFixed(1)} g · expected at age {player.age} ≈{' '}
            {Math.round(throwExpectedKmh(player))} km/h
          </Body>
          {result.clipped ? (
            <Body style={{ color: colors.warn, fontSize: 14, textAlign: 'center' }}>
              The throw went past this phone&apos;s sensor range, so the real speed was probably higher.
            </Body>
          ) : null}
        </ResultBoard>
        {renderDone(attempt, reset)}
      </CaptureFrame>
    );
  }

  return (
    <CaptureFrame {...frame}>
      {phase === 'idle' ? (
        <IdlePanel
          accent={accent}
          title="READY TO THROW?"
          lines={`${sport.placement}\nHold your arm still in the start position. When you hear "Throw!", throw as hard as you can.`}
          buttonLabel="Start"
          onStart={start}
        >
          <TechniqueDemo sport={sport.id} accent={accent} />
          {notice ? <Body style={{ color: colors.warn, textAlign: 'center' }}>{notice}</Body> : null}
        </IdlePanel>
      ) : (
        <Stage accent={accent} minHeight={300}>
          {phase === 'settling' ? (
            <>
              <Text style={styles.call}>HOLD STILL</Text>
              <Body style={{ color: colors.muted, textAlign: 'center' }}>
                Arm in the start position. The app is measuring gravity on the phone.
              </Body>
            </>
          ) : (
            <>
              <Text style={[styles.call, styles.throw, { color: accent }]}>THROW!</Text>
              <Body style={{ color: colors.muted, textAlign: 'center' }}>Throw as hard as you can</Body>
            </>
          )}
          <Button label="Cancel" variant="ghost" onPress={reset} />
        </Stage>
      )}
    </CaptureFrame>
  );
}

const styles = StyleSheet.create({
  call: { color: colors.text, fontFamily: fonts.black, fontSize: 56, lineHeight: 72, letterSpacing: 2, textAlign: 'center' },
  throw: { fontSize: 72, lineHeight: 90, marginBottom: space.sm },
});
