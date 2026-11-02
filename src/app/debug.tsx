import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text } from 'react-native';
import * as Device from 'expo-device';
import { useKeepAwake } from 'expo-keep-awake';
import { useJumpSensor } from '@/hooks/useJumpSensor';
import { AccelSample, DEFAULT_CONFIG, GyroSample, JumpResult } from '@/lib/jumpDetector';
import { LineChart } from '@/components/LineChart';
import { Body, Button, Card, Label, Row, Screen, Stat } from '@/components/ui';
import { colors, fonts } from '@/theme/theme';

const WINDOW_S = 4;
const EXPORT_S = 10;
const MAX_POINTS = 160;

interface Mag {
  t: number;
  v: number;
}

function downsample(list: Mag[], tNow: number): number[] {
  const recent = list.filter((m) => m.t >= tNow - WINDOW_S);
  if (recent.length <= MAX_POINTS) return recent.map((m) => m.v);
  const step = recent.length / MAX_POINTS;
  const out: number[] = [];
  for (let i = 0; i < MAX_POINTS; i++) out.push(recent[Math.floor(i * step)].v);
  return out;
}

const REASON: Record<string, string> = {
  'too-short': 'too short',
  'too-long': 'flight too long',
  'no-pushoff': 'no push-off',
  'no-impact': 'no landing impact',
  'data-gap': 'gap in sensor data',
};

export default function DebugScreen() {
  useKeepAwake();
  const [running, setRunning] = useState(false);
  const [, setFrame] = useState(0);
  const [results, setResults] = useState<JumpResult[]>([]);

  const accelBuf = useRef<AccelSample[]>([]);
  const gyroBuf = useRef<GyroSample[]>([]);

  const status = useJumpSensor({
    active: running,
    onAccel: (s) => {
      accelBuf.current.push(s);
      const cut = s.t - EXPORT_S;
      while (accelBuf.current.length > 0 && accelBuf.current[0].t < cut) accelBuf.current.shift();
    },
    onGyro: (s) => {
      gyroBuf.current.push(s);
      const cut = s.t - EXPORT_S;
      while (gyroBuf.current.length > 0 && gyroBuf.current[0].t < cut) gyroBuf.current.shift();
    },
    onResult: (r) => setResults((list) => [r, ...list].slice(0, 8)),
  });

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setFrame((f) => f + 1), 70);
    return () => clearInterval(id);
  }, [running]);

  const accel = accelBuf.current;
  const gyro = gyroBuf.current;
  const tNow = accel.length ? accel[accel.length - 1].t : 0;
  const accelMags: Mag[] = accel.map((s) => ({ t: s.t, v: Math.hypot(s.x, s.y, s.z) }));
  const gyroMags: Mag[] = gyro.map((s) => ({ t: s.t, v: Math.hypot(s.x, s.y, s.z) }));
  const last = accelMags.length ? accelMags[accelMags.length - 1].v : 0;
  const lastGyro = gyroMags.length ? gyroMags[gyroMags.length - 1].v : 0;
  const rate = accel.filter((s) => s.t >= tNow - 1).length;

  const share = async () => {
    const payload = {
      device: Device.modelName,
      os: `${Device.osName} ${Device.osVersion}`,
      accel: accel.map((s) => [s.t, s.x, s.y, s.z]),
      gyro: gyro.map((s) => [s.t, s.x, s.y, s.z]),
    };
    await Share.share({ message: JSON.stringify(payload) });
  };

  return (
    <Screen>
      <Body style={{ color: colors.muted }}>
        See the raw signal while jumping and tune the thresholds. Hold the phone or pocket it and jump.
      </Body>
      <Button
        label={running ? 'Stop' : 'Start reading sensors'}
        variant={running ? 'secondary' : 'primary'}
        onPress={() => setRunning((r) => !r)}
      />
      {status === 'unavailable' || status === 'denied' ? (
        <Body style={{ color: colors.danger }}>
          {status === 'denied' ? 'Sensor access was denied' : 'No accelerometer found on this device'}
        </Body>
      ) : null}

      <Card>
        <Row>
          <Stat label="|a| now" value={last.toFixed(2)} unit="g" />
          <Stat label="|ω| now" value={lastGyro.toFixed(1)} unit="rad/s" color={colors.spin} />
          <Stat label="Rate" value={String(rate)} unit="Hz" />
        </Row>
      </Card>

      <Card>
        <Label>Accelerometer |a| (g) · dashed = flight in / flight out / 1 g</Label>
        <LineChart
          values={downsample(accelMags, tNow)}
          min={0}
          max={4}
          guides={[
            { y: DEFAULT_CONFIG.flightEnterG, color: colors.danger },
            { y: DEFAULT_CONFIG.flightExitG, color: colors.warn },
            { y: 1, color: colors.border },
            { y: DEFAULT_CONFIG.minImpactG, color: colors.muted },
          ]}
        />
      </Card>

      <Card>
        <Label>Gyroscope |ω| (rad/s)</Label>
        <LineChart values={downsample(gyroMags, tNow)} min={0} max={12} color={colors.spin} />
      </Card>

      <Card>
        <Label>Latest detections</Label>
        {results.length === 0 ? <Body style={{ color: colors.muted }}>None yet</Body> : null}
        {results.map((r, i) => (
          <Text key={i} style={[styles.line, { color: r.ok ? colors.accent : colors.warn }]}>
            {r.ok
              ? `✓ ${r.heightCm.toFixed(1)} cm · ${Math.round(r.flightMs)} ms · spin ${Math.round(r.spinDeg)}° · ${r.impactG.toFixed(1)} g`
              : `✗ ${REASON[r.reason] ?? r.reason} (${Math.round(r.flightMs)} ms)`}
          </Text>
        ))}
      </Card>

      <Button label="Share the last 10 s of raw data" variant="secondary" onPress={share} disabled={accel.length === 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { fontSize: 15, fontFamily: fonts.semi },
});
