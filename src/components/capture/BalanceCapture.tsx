import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCountdown } from '@/hooks/useCountdown';
import { useSensorStatus } from '@/hooks/useSensorStatus';
import { useSensorStream } from '@/hooks/useSensorStream';
import { BalanceResult, BalanceTracker, DEFAULT_BALANCE_CONFIG } from '@/lib/balance';
import { speak, stopSpeaking, success, warn } from '@/lib/feedback';
import { balanceExpectedSwayMg } from '@/lib/scoring';
import { colors, fonts, radius, space } from '@/theme/theme';
import { Body, Button } from '../ui';
import { TechniqueDemo } from '../TechniqueDemo';
import { CaptureFrame, IdlePanel, ResultBoard, SensorProblem, Stage } from './parts';
import { CaptureProps } from './types';

type Phase = 'idle' | 'countdown' | 'running' | 'done';

const COUNTDOWN_S = 5;

export function BalanceCapture({ sport, player, tag, accent, caption, rounds, resetKey, onAttempt, renderDone }: CaptureProps) {
  const status = useSensorStatus(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [sway, setSway] = useState(0);
  const [result, setResult] = useState<BalanceResult | null>(null);

  const tracker = useRef(new BalanceTracker());
  const lastT = useRef(0);
  const reported = useRef(false);
  const onAttemptRef = useRef(onAttempt);
  onAttemptRef.current = onAttempt;

  const reset = () => {
    stopSpeaking();
    setPhase('idle');
    setResult(null);
    setElapsed(0);
    setSway(0);
  };
  useEffect(reset, [resetKey]);

  const start = () => {
    tracker.current = new BalanceTracker();
    reported.current = false;
    lastT.current = 0;
    setPhase('countdown');
  };

  const count = useCountdown(phase === 'countdown', COUNTDOWN_S, () => setPhase('running'), {
    intro: 'Phone in the pocket on your standing leg. Stand still on both feet.',
    outro: 'Lift your leg',
  });

  useSensorStream({
    status,
    active: phase === 'running',
    onAccel: (s) => {
      lastT.current = s.t;
      tracker.current.pushAccel(s);
    },
    onGyro: (g) => tracker.current.pushGyro(g.x, g.y, g.z),
  });

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => {
      const t = tracker.current;
      setElapsed(t.elapsed(lastT.current));
      setSway(t.liveSwayMg);
      if (t.done && !reported.current) {
        reported.current = true;
        const r = t.result();
        if (r.ended === 'touch') warn();
        else success();
        speak(r.ended === 'touch' ? `${r.stoodSeconds.toFixed(0)} seconds` : 'Time! Well done');
        setResult(r);
        setPhase('done');
        onAttemptRef.current({ value: r.stoodSeconds, value2: r.swayMg });
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  const frame = { player, caption, tag, accent, rounds };

  if (status === 'unavailable' || status === 'denied') {
    return (
      <CaptureFrame {...frame}>
        <SensorProblem status={status} gyro />
      </CaptureFrame>
    );
  }

  if (phase === 'done' && result) {
    const attempt = { value: result.stoodSeconds, value2: result.swayMg };
    return (
      <CaptureFrame {...frame}>
        <ResultBoard
          accent={accent}
          label="TIME ON ONE LEG"
          value={result.stoodSeconds}
          decimals={1}
          unit="seconds"
          points={sport.score(attempt, player)}
        >
          <Text style={styles.line}>
            {result.ended === 'time' ? 'Full 20 seconds 👏' : 'Foot touched down'}
          </Text>
          <Body style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}>
            Mean sway {result.swayMg.toFixed(1)} mg (expected at age {player.age} ≈{' '}
            {balanceExpectedSwayMg(player.age).toFixed(0)} mg) · mean rotation {result.gyroDps.toFixed(1)}°/s
          </Body>
        </ResultBoard>
        {renderDone(attempt, reset)}
      </CaptureFrame>
    );
  }

  const limit = DEFAULT_BALANCE_CONFIG.durationS;
  const remaining = Math.max(0, limit - elapsed);

  return (
    <CaptureFrame {...frame}>
      {phase === 'idle' ? (
        <IdlePanel
          accent={accent}
          title="READY?"
          lines={`${sport.placement}\nStay as still as you can for ${limit} seconds. The clock stops if your raised foot touches the ground.`}
          buttonLabel="Start countdown"
          onStart={start}
        >
          <TechniqueDemo sport={sport.id} accent={accent} />
        </IdlePanel>
      ) : (
        <Stage accent={accent}>
          {phase === 'countdown' ? (
            <>
              <Text style={[styles.count, { color: accent }]} accessibilityLiveRegion="polite">
                {count}
              </Text>
              <Body>Phone in the pocket on your standing leg. Stand still on both feet.</Body>
              <Button label="Cancel" variant="ghost" onPress={reset} />
            </>
          ) : (
            <>
              <Text style={styles.cue}>{elapsed < DEFAULT_BALANCE_CONFIG.graceS ? 'Lift your leg!' : 'Hold still!'}</Text>
              <Text style={[styles.timer, { color: accent }]} accessibilityLiveRegion="polite">
                {Math.ceil(remaining)}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { backgroundColor: accent, width: `${Math.min(100, (elapsed / limit) * 100)}%` }]} />
              </View>
              <Body style={{ color: colors.muted }}>Sway now {sway.toFixed(0)} mg</Body>
              <Button label="Cancel" variant="ghost" onPress={reset} />
            </>
          )}
        </Stage>
      )}
    </CaptureFrame>
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: fonts.black, fontSize: 150, lineHeight: 180, includeFontPadding: false },
  cue: { color: colors.text, fontFamily: fonts.bold, fontSize: 28, lineHeight: 38 },
  timer: { fontFamily: fonts.black, fontSize: 120, lineHeight: 140, includeFontPadding: false },
  track: { alignSelf: 'stretch', height: 12, borderRadius: radius.pill, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  line: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, marginTop: space.sm },
});
