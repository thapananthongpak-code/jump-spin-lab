import { useEffect, useState } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';

export type SensorStatus = 'checking' | 'ready' | 'unavailable' | 'denied';

/**
 * Check once that the sensors exist and are allowed. The accelerometer is always required;
 * pass `requireGyro` for sports that cannot work without the gyroscope.
 */
export function useSensorStatus(requireGyro = false): SensorStatus {
  const [status, setStatus] = useState<SensorStatus>('checking');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [accel, gyro] = await Promise.all([
          Accelerometer.isAvailableAsync(),
          Gyroscope.isAvailableAsync(),
        ]);
        if (!alive) return;
        if (!accel || (requireGyro && !gyro)) return setStatus('unavailable');
        const perm = await Accelerometer.requestPermissionsAsync();
        if (!alive) return;
        if (!perm.granted) return setStatus('denied');
        setStatus('ready');
      } catch {
        if (alive) setStatus('unavailable');
      }
    })();
    return () => {
      alive = false;
    };
  }, [requireGyro]);

  return status;
}
