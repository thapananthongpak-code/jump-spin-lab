import { DependencyList, useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** Run an async loader every time the screen gains focus, so lists are never stale. */
export function useFocusLoad<T>(loader: () => Promise<T>, initial: T, deps: DependencyList): [T, boolean] {
  const [data, setData] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      load().then((d) => {
        if (alive) {
          setData(d);
          setLoaded(true);
        }
      });
      return () => {
        alive = false;
      };
    }, [load]),
  );
  return [data, loaded];
}
