import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleProp, Text, TextStyle } from 'react-native';

interface Props {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
  style?: StyleProp<TextStyle>;
}

/** A number that counts up from 0, like a stadium scoreboard. Shows the value at once if the user prefers reduced motion. */
export function CountUp({ value, decimals = 1, duration = 800, suffix = '', style }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let id: string | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          setShown(value);
          return;
        }
        anim.setValue(0);
        id = anim.addListener(({ value: v }) => setShown(v));
        Animated.timing(anim, {
          toValue: value,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      });
    return () => {
      cancelled = true;
      if (id) anim.removeListener(id);
      anim.stopAnimation();
    };
  }, [value, duration, anim]);

  return (
    <Text style={style} accessibilityLabel={`${value.toFixed(decimals)}${suffix}`}>
      {shown.toFixed(decimals)}
      {suffix}
    </Text>
  );
}
