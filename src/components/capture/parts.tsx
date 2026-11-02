import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { SensorStatus } from '@/hooks/useSensorStatus';
import { colors, fonts, radius, space } from '@/theme/theme';
import { CountUp } from '../CountUp';
import { RoundDots, SportHeader } from '../SportHeader';
import { Body, Button, Card } from '../ui';
import { CaptureProps } from './types';

/** Header (lane colour, bib, name, round dots) around whatever the sport shows. */
export function CaptureFrame({
  player,
  caption,
  tag,
  accent,
  rounds,
  children,
}: Pick<CaptureProps, 'player' | 'caption' | 'tag' | 'accent' | 'rounds'> & { children: ReactNode }) {
  useKeepAwake();
  return (
    <View style={{ gap: space.md }}>
      <SportHeader
        tag={tag}
        name={player.name}
        caption={caption}
        color={accent}
        right={<RoundDots total={rounds.total} done={rounds.done} color={accent} />}
      />
      {children}
    </View>
  );
}

export function Stage({
  accent,
  active = true,
  children,
  minHeight = 280,
}: {
  accent: string;
  active?: boolean;
  children: ReactNode;
  minHeight?: number;
}) {
  return (
    <View style={[styles.stage, { borderColor: active ? accent : colors.border, minHeight }]}>{children}</View>
  );
}

/** First screen of a round: what to do, where the phone goes, start button. */
export function IdlePanel({
  accent,
  title,
  lines,
  buttonLabel,
  onStart,
  children,
}: {
  accent: string;
  title: string;
  lines: string;
  buttonLabel: string;
  onStart: () => void;
  children?: ReactNode;
}) {
  return (
    <Stage accent={accent} active={false}>
      <Text style={styles.ready}>{title}</Text>
      <Body style={{ textAlign: 'center', color: colors.muted }}>{lines}</Body>
      {children}
      <Button label={buttonLabel} color={accent} onPress={onStart} style={{ alignSelf: 'stretch' }} />
    </Stage>
  );
}

/** The scoreboard-style result of one attempt. */
export function ResultBoard({
  accent,
  label,
  value,
  decimals,
  unit,
  points,
  children,
}: {
  accent: string;
  label: string;
  value: number;
  decimals: number;
  unit: string;
  points: number;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.stage, { borderColor: accent, minHeight: 0 }]}>
      <Text style={styles.stageLabel}>{label}</Text>
      <CountUp value={value} decimals={decimals} style={[styles.bigNumber, { color: accent }]} />
      <Text style={styles.bigUnit}>{unit}</Text>
      <View style={[styles.pointsPill, { backgroundColor: accent }]}>
        <CountUp value={points} decimals={1} duration={1000} suffix=" pts" style={styles.pointsText} />
      </View>
      {children}
    </View>
  );
}

export function SensorProblem({ status, gyro }: { status: SensorStatus; gyro?: boolean }) {
  return (
    <Card>
      <Body style={{ color: colors.danger }}>
        {status === 'denied'
          ? 'Motion sensor access was denied. Allow it in your phone settings.'
          : gyro
            ? 'This device has no working gyroscope (use a real phone, not an emulator).'
            : 'This device has no working accelerometer (use a real phone, not an emulator).'}
      </Body>
    </Card>
  );
}

export const captureStyles = StyleSheet.create({
  bigNumberSmall: { fontFamily: fonts.black, fontSize: 64, lineHeight: 76, includeFontPadding: false },
});

const styles = StyleSheet.create({
  stage: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    alignItems: 'center',
    gap: space.sm,
    justifyContent: 'center',
  },
  stageLabel: { color: colors.muted, fontFamily: fonts.semi, fontSize: 13, letterSpacing: 1.5, textAlign: 'center' },
  ready: { color: colors.text, fontFamily: fonts.black, fontSize: 40, letterSpacing: 3, lineHeight: 52, textAlign: 'center' },
  bigNumber: { fontFamily: fonts.black, fontSize: 84, lineHeight: 100, includeFontPadding: false },
  bigUnit: { color: colors.muted, fontFamily: fonts.semi, fontSize: 18, marginTop: -6 },
  pointsPill: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4, marginTop: space.sm },
  pointsText: { color: colors.onAccent, fontFamily: fonts.black, fontSize: 22, lineHeight: 30 },
});
