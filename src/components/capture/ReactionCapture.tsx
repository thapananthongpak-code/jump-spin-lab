import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { nowSeconds, useSensorStream } from '@/hooks/useSensorStream';
import { useSensorStatus } from '@/hooks/useSensorStatus';
import { cue, speak, stopSpeaking, success, warn } from '@/lib/feedback';
import { ReactionDetector, ReactionEvent } from '@/lib/reaction';
import { reactionExpectedMs } from '@/lib/scoring';
import { colors, fonts, radius, space } from '@/theme/theme';
import { Body, Button } from '../ui';
import { TechniqueDemo } from '../TechniqueDemo';
import { CaptureFrame, IdlePanel, ResultBoard, SensorProblem, Stage } from './parts';
import { CaptureProps } from './types';

type Phase = 'idle' | 'settling' | 'armed' | 'go' | 'done' | 'foul';

const MIN_WAIT_S = 1.5;
const MAX_WAIT_S = 4;

export function ReactionCapture({ sport, player, tag, accent, caption, rounds, resetKey, onAttempt, renderDone }: CaptureProps) {
  const status = useSensorStatus(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [reactionMs, setReactionMs] = useState(0);
  const [foulReason, setFoulReason] = useState<'early' | 'anticipated'>('early');
  const [notice, setNotice] = useState<string | null>(null);

  const detector = useRef(new ReactionDetector());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAttemptRef = useRef(onAttempt);
  onAttemptRef.current = onAttempt;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const reset = () => {
    clearTimer();
    stopSpeaking();
    setPhase('idle');
  };
  useEffect(reset, [resetKey]);
  useEffect(() => clearTimer, []);

  const handle = (e: ReactionEvent) => {
    switch (e.type) {
      case 'ready': {
        setPhase('armed');
        speak('Set');
        const wait = MIN_WAIT_S + Math.random() * (MAX_WAIT_S - MIN_WAIT_S);
        timer.current = setTimeout(() => {
          // the cue time and the sensor samples use the same clock
          detector.current.signal(nowSeconds());
          cue();
          // the buzz is the timed cue; the voice is a backup the player may hear a moment later
          speak('Go!');
          setPhase('go');
        }, wait * 1000);
        return;
      }
      case 'false-start':
        clearTimer();
        warn();
        setFoulReason(e.reason);
        setPhase('foul');
        onAttemptRef.current({ value: 0, foul: true });
        return;
      case 'result':
        clearTimer();
        success();
        setReactionMs(e.reactionMs);
        setPhase('done');
        onAttemptRef.current({ value: e.reactionMs });
        return;
      case 'timeout':
        clearTimer();
        setNotice('No start detected, so this round does not count. Try again.');
        setPhase('idle');
        return;
    }
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useSensorStream({
    status,
    active: phase === 'settling' || phase === 'armed' || phase === 'go',
    clock: 'arrival',
    onAccel: (s) => {
      const e = detector.current.pushAccel(s.t, Math.hypot(s.x, s.y, s.z));
      if (e) handleRef.current(e);
    },
    onGyro: (g) => detector.current.pushGyro(Math.hypot(g.x, g.y, g.z)),
  });

  const start = () => {
    detector.current = new ReactionDetector();
    setNotice(null);
    setPhase('settling');
    speak('On your marks');
  };

  const frame = { player, caption, tag, accent, rounds };

  if (status === 'unavailable' || status === 'denied') {
    return (
      <CaptureFrame {...frame}>
        <SensorProblem status={status} />
      </CaptureFrame>
    );
  }

  if (phase === 'foul') {
    const attempt = { value: 0, foul: true };
    return (
      <CaptureFrame {...frame}>
        <Stage accent={colors.danger}>
          <Text style={styles.foulTitle}>FALSE START</Text>
          <Body style={{ textAlign: 'center' }}>
            {foulReason === 'early' ? 'You moved before the signal' : 'Too fast to be a reaction (under 100 ms)'}
          </Body>
          <Text style={styles.foulPoints}>0 pts</Text>
        </Stage>
        {renderDone(attempt, reset)}
      </CaptureFrame>
    );
  }

  if (phase === 'done') {
    const attempt = { value: reactionMs };
    return (
      <CaptureFrame {...frame}>
        <ResultBoard
          accent={accent}
          label="REACTION TIME"
          value={reactionMs}
          decimals={0}
          unit="milliseconds"
          points={sport.score(attempt, player)}
        >
          <Body style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}>
            Expected at age {player.age} ≈ {Math.round(reactionExpectedMs(player.age))} ms
          </Body>
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
          title="ON YOUR MARK"
          lines={`${sport.placement}\nYou will hear "On your marks" and "Set". Then the phone buzzes hard and says "Go!": start right away. Moving before the buzz is a false start.`}
          buttonLabel="On your marks"
          onStart={start}
        >
          <TechniqueDemo sport={sport.id} accent={accent} />
          {notice ? <Body style={{ color: colors.warn, textAlign: 'center' }}>{notice}</Body> : null}
        </IdlePanel>
      ) : phase === 'go' ? (
        <View style={[styles.goPanel, { backgroundColor: accent }]} accessibilityLiveRegion="assertive">
          <Text style={styles.go}>GO!</Text>
        </View>
      ) : (
        <Stage accent={accent} minHeight={300}>
          {phase === 'settling' ? (
            <>
              <Text style={styles.call}>HOLD STILL</Text>
              <Body style={{ color: colors.muted, textAlign: 'center' }}>
                Get into your start position. The app waits until you are still for 1 second.
              </Body>
              <Button label="Cancel" variant="ghost" onPress={reset} />
            </>
          ) : (
            <>
              <Text style={[styles.call, { color: colors.warn }]}>SET…</Text>
              <Body style={{ color: colors.muted, textAlign: 'center' }}>Wait for the buzz. Don't move.</Body>
            </>
          )}
        </Stage>
      )}
    </CaptureFrame>
  );
}

const styles = StyleSheet.create({
  call: { color: colors.text, fontFamily: fonts.black, fontSize: 60, lineHeight: 76, letterSpacing: 2 },
  goPanel: { minHeight: 300, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  go: {
    color: colors.onAccent,
    fontFamily: fonts.black,
    fontSize: 130,
    lineHeight: 150,
    letterSpacing: 4,
    includeFontPadding: false,
  },
  foulTitle: { color: colors.danger, fontFamily: fonts.black, fontSize: 44, lineHeight: 56, letterSpacing: 2 },
  foulPoints: {
    color: colors.onAccent,
    backgroundColor: colors.danger,
    fontFamily: fonts.black,
    fontSize: 20,
    lineHeight: 28,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 2,
    overflow: 'hidden',
    marginTop: space.sm,
  },
});
