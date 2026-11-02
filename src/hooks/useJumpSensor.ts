import { useEffect, useRef } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import {
  AccelSample,
  DetectorConfig,
  GyroSample,
  JumpDetector,
  JumpResult,
} from '@/lib/jumpDetector';
import { SensorStatus, useSensorStatus } from './useSensorStatus';

export type { SensorStatus };

const INTERVAL_MS = 10; // ask for 100 Hz

interface Options {
  /** Listen to the sensors and run the detector only while true. */
  active: boolean;
  onResult?: (r: JumpResult) => void;
  onAccel?: (s: AccelSample) => void;
  onGyro?: (s: GyroSample) => void;
  config?: Partial<DetectorConfig>;
}

const stamp = (t: number | undefined): number =>
  t && t > 0 ? t : (globalThis.performance?.now?.() ?? Date.now()) / 1000;

/** Check availability and permission once, then stream both sensors into a JumpDetector. */
export function useJumpSensor({ active, onResult, onAccel, onGyro, config }: Options): SensorStatus {
  const status = useSensorStatus();
  const cb = useRef({ onResult, onAccel, onGyro });
  cb.current = { onResult, onAccel, onGyro };
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!active || status !== 'ready') return;
    const detector = new JumpDetector(configRef.current);
    Accelerometer.setUpdateInterval(INTERVAL_MS);
    Gyroscope.setUpdateInterval(INTERVAL_MS);

    const gyroSub = Gyroscope.addListener((m) => {
      const s = { t: stamp(m.timestamp), x: m.x, y: m.y, z: m.z };
      detector.pushGyro(s);
      cb.current.onGyro?.(s);
    });
    const accelSub = Accelerometer.addListener((m) => {
      const s = { t: stamp(m.timestamp), x: m.x, y: m.y, z: m.z };
      cb.current.onAccel?.(s);
      const r = detector.pushAccel(s);
      if (r) cb.current.onResult?.(r);
    });
    return () => {
      accelSub.remove();
      gyroSub.remove();
    };
  }, [active, status]);

  return status;
}
