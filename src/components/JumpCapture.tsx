import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useJumpSensor } from '@/hooks/useJumpSensor';
import { JumpMeasurement, JumpResult, RejectReason } from '@/lib/jumpDetector';
import { speak, stopSpeaking, success, tick, warn } from '@/lib/feedback';
import { formatDeg, rotationsText } from '@/lib/format';
import { SportId } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme/theme';
import { CountUp } from './CountUp';
import { RoundDots, SportHeader } from './SportHeader';
import { TechniqueDemo } from './TechniqueDemo';
import { Body, Button, Card, Row, Stat } from './ui';

const COUNTDOWN_S = 5;

type Phase = 'idle' | 'countdown' | 'listening' | 'done';

const REJECT_TEXT: Record<RejectReason, string> = {
  'too-short': '',
  'too-long': 'Flight was unusually long (did the phone fall?)',
  'no-pushoff': 'No push-off detected (was the phone thrown?)',
  'no-impact': 'No landing impact detected. Land a bit more firmly.',
  'data-gap': 'Sensor data had a gap. Try again.',
};

interface Props {
  playerName: string;
  /** small caption above the name, e.g. the event */
  caption?: string;
  /** bib shown in the header, e.g. "P2" */
  tag?: string;
  /** lane colour of the player */
  accent?: string;
  /** round progress dots: `done` rounds finished out of `total` */
  rounds?: { total: number; done: number };
  /** points for the result card; leave out to hide */
  scoreFor?: (m: JumpMeasurement) => number;
  /** Changing this value sends the component back to its idle state (e.g. next player). */
  resetKey?: string | number;
  onMeasured: (m: JumpMeasurement) => void;
  renderDone: (m: JumpMeasurement, retry: () => void) => ReactNode;
  /** which technique demo to show before starting */
  demo?: SportId;
}

export function JumpCapture({
  playerName,
  caption,
  tag,
  accent = colors.accent,
  rounds,
  scoreFor,
  resetKey,
  onMeasured,
  renderDone,
  demo = 'height',
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState(COUNTDOWN_S);
  const [result, setResult] = useState<JumpMeasurement | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  const onMeasuredRef = useRef(onMeasured);
  onMeasuredRef.current = onMeasured;

  const pop = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useKeepAwake();

  const handleResult = useCallback((r: JumpResult) => {
    if (!r.ok) {
      const msg = REJECT_TEXT[r.reason];
      if (!msg) return; // tiny bumps are noise, not an attempt
      warn();
      speak('Not counted. Try again.');
      setRejection(msg);
      return;
    }
    success();
    const spin = r.spinDeg >= 90 ? `, spin ${Math.round(r.spinDeg)} degrees` : '';
    speak(`${Math.round(r.heightCm)} centimeters${spin}`);
    setResult(r);
    setRejection(null);
    setPhase('done');
    onMeasuredRef.current(r);
  }, []);

  const sensorStatus = useJumpSensor({ active: phase === 'listening', onResult: handleResult });

  const reset = useCallback(() => {
    stopSpeaking();
    setPhase('idle');
    setResult(null);
    setRejection(null);
    setCount(COUNTDOWN_S);
  }, []);

  useEffect(() => {
    reset();
  }, [resetKey, reset]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    setCount(COUNTDOWN_S);
    speak('Put the phone in your pocket');
    let n = COUNTDOWN_S;
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        warn();
        speak('Jump!');
        setPhase('listening');
      } else {
        tick();
        setCount(n);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // each countdown number "pops" in
  useEffect(() => {
    if (phase !== 'countdown') return;
    pop.setValue(1.7);
    Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [count, phase, pop]);

  // GO! pulses while the app is listening for the jump
  useEffect(() => {
    if (phase !== 'listening') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 450, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [phase, pulse]);

  useEffect(() => () => stopSpeaking(), []);

  const header = (
    <SportHeader
      tag={tag}
      name={playerName}
      caption={caption}
      color={accent}
      right={rounds ? <RoundDots total={rounds.total} done={rounds.done} color={accent} /> : undefined}
    />
  );

  if (sensorStatus === 'unavailable' || sensorStatus === 'denied') {
    return (
      <View style={{ gap: space.md }}>
        {header}
        <Card>
          <Body style={{ color: colors.danger }}>
            {sensorStatus === 'denied'
              ? 'Motion sensor access was denied. Allow it in your phone settings.'
              : 'This device has no working accelerometer (use a real phone, not an emulator).'}
          </Body>
        </Card>
      </View>
    );
  }

  if (phase === 'done' && result) {
    const points = scoreFor ? scoreFor(result) : null;
    return (
      <View style={{ gap: space.md }}>
        {header}
        <View style={[styles.stage, { borderColor: accent }]}>
          <Text style={styles.stageLabel}>HEIGHT</Text>
          <CountUp
            value={result.heightCm}
            decimals={1}
            style={[styles.bigNumber, { color: accent }]}
          />
          <Text style={styles.bigUnit}>centimeters</Text>
          {points !== null ? (
            <View style={[styles.pointsPill, { backgroundColor: accent }]}>
              <CountUp value={points} decimals={1} duration={1000} suffix=" pts" style={styles.pointsText} />
            </View>
          ) : null}
          <Row style={{ alignSelf: 'stretch', marginTop: space.md }}>
            <Stat label="Flight time" value={String(Math.round(result.flightMs))} unit="ms" />
            <Stat
              label="Spin"
              value={formatDeg(result.spinDeg)}
              unit={`° ${rotationsText(result.spinDeg)}`}
              color={colors.spin}
            />
            <Stat label="Impact" value={result.impactG.toFixed(1)} unit="g" />
          </Row>
        </View>
        {renderDone(result, reset)}
      </View>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      {header}
      <View style={[styles.stage, { borderColor: phase === 'idle' ? colors.border : accent }]}>
        {phase === 'idle' && (
          <>
            <Text style={styles.ready}>READY?</Text>
            <Body style={{ textAlign: 'center', color: colors.muted }}>
              Put the phone snugly in your trouser pocket (or an armband).{'\n'}
              {demo === 'spin'
                ? 'Stand still, wait for the voice cue, then jump and turn your whole body in the air.'
                : 'Stand still, wait for the voice cue, then jump straight up with hands on hips.'}
            </Body>
            <TechniqueDemo sport={demo} accent={accent} />
            <Button
              label="Start countdown"
              color={accent}
              onPress={() => setPhase('countdown')}
              style={{ alignSelf: 'stretch' }}
            />
          </>
        )}

        {phase === 'countdown' && (
          <>
            <Animated.Text
              style={[styles.countdown, { color: accent, transform: [{ scale: pop }] }]}
              accessibilityLiveRegion="polite"
            >
              {count}
            </Animated.Text>
            <Body>Put the phone in your pocket and stand still</Body>
            <Button label="Cancel" variant="ghost" onPress={reset} />
          </>
        )}

        {phase === 'listening' && (
          <>
            <Animated.Text
              style={[styles.go, { color: accent, transform: [{ scale: pulse }] }]}
              accessibilityLiveRegion="assertive"
            >
              GO!
            </Animated.Text>
            <Body>Jump now!</Body>
            {rejection ? <Body style={{ color: colors.warn, textAlign: 'center' }}>{rejection}</Body> : null}
            <Button label="Cancel" variant="ghost" onPress={reset} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    alignItems: 'center',
    gap: space.sm,
    minHeight: 280,
    justifyContent: 'center',
  },
  stageLabel: { color: colors.muted, fontFamily: fonts.semi, fontSize: 13, letterSpacing: 2 },
  ready: { color: colors.text, fontFamily: fonts.black, fontSize: 44, letterSpacing: 4, lineHeight: 56 },
  countdown: { fontFamily: fonts.black, fontSize: 150, lineHeight: 180, includeFontPadding: false },
  go: { fontFamily: fonts.black, fontSize: 110, lineHeight: 130, letterSpacing: 4, includeFontPadding: false },
  bigNumber: { fontFamily: fonts.black, fontSize: 92, lineHeight: 108, includeFontPadding: false },
  bigUnit: { color: colors.muted, fontFamily: fonts.semi, fontSize: 18, marginTop: -8 },
  pointsPill: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4, marginTop: space.sm },
  pointsText: { color: colors.onAccent, fontFamily: fonts.black, fontSize: 22, lineHeight: 30 },
});
