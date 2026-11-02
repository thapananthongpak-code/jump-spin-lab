import { useEffect, useRef } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { AccelSample, GyroSample } from '@/lib/jumpDetector';
import { SensorStatus } from './useSensorStatus';

/** Seconds on a clock that both sensors share (they are stamped on arrival). */
export const nowSeconds = (): number => (globalThis.performance?.now?.() ?? Date.now()) / 1000;

interface Options {
  status: SensorStatus;
  active: boolean;
  /** pass a handler to subscribe to that sensor; leave it out to leave the sensor off */
  onAccel?: (s: AccelSample) => void;
  onGyro?: (s: GyroSample) => void;
  /**
   * 'arrival': stamp samples with the time the app received them. Needed when sensor time
   * must be compared with things the app does itself (e.g. firing a start cue).
   * 'sensor': use the sensor's own timestamps (more regular, but a different clock).
   */
  clock?: 'arrival' | 'sensor';
  intervalMs?: number;
}

const stampOf = (clock: 'arrival' | 'sensor', t: number | undefined): number =>
  clock === 'sensor' && t && t > 0 ? t : nowSeconds();

/** Streams the accelerometer and/or gyroscope to the handlers while `active` and the sensors are ready. */
export function useSensorStream({ status, active, onAccel, onGyro, clock = 'sensor', intervalMs = 10 }: Options): void {
  const handlers = useRef({ onAccel, onGyro });
  handlers.current = { onAccel, onGyro };
  const wantsAccel = !!onAccel;
  const wantsGyro = !!onGyro;

  useEffect(() => {
    if (!active || status !== 'ready') return;
    const subs: { remove: () => void }[] = [];
    if (wantsGyro) {
      Gyroscope.setUpdateInterval(intervalMs);
      subs.push(
        Gyroscope.addListener((m) =>
          handlers.current.onGyro?.({ t: stampOf(clock, m.timestamp), x: m.x, y: m.y, z: m.z }),
        ),
      );
    }
    if (wantsAccel) {
      Accelerometer.setUpdateInterval(intervalMs);
      subs.push(
        Accelerometer.addListener((m) =>
          handlers.current.onAccel?.({ t: stampOf(clock, m.timestamp), x: m.x, y: m.y, z: m.z }),
        ),
      );
    }
    return () => subs.forEach((s) => s.remove());
  }, [active, status, wantsAccel, wantsGyro, clock, intervalMs]);
}
