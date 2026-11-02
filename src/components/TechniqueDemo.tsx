import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { DEMOS, frameAt, GROUND_Y, Skeleton, solve, VIEW } from '@/lib/technique';
import { SportId } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme/theme';

const FAR = '#5B6675';
const NEAR = colors.text;
const TRAIL_STEPS = 7;
const TRAIL_DT = 0.035;

/** Loops time while mounted (~30 fps). With "reduce motion" on, it jumps from step to step. */
function useDemoClock(steps: number[], keysAt: number[]): number {
  const [t, setT] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduced) {
      // show the first pose of each step for 2.5 s
      const starts = keysAt.filter((_, i) => i === 0 || steps[i] !== steps[i - 1]);
      let i = 0;
      setT(starts[0] ?? 0);
      const id = setInterval(() => {
        i = (i + 1) % starts.length;
        setT(starts[i]);
      }, 2500);
      return () => clearInterval(id);
    }
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      if (now - last > 32) {
        last = now;
        setT((now - t0) / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, steps, keysAt]);

  return t;
}

function Figure({ s, accent, buzz }: { s: Skeleton; accent: string; buzz: boolean }) {
  // squash sideways about the hip to show the body turning
  const X = (p: [number, number]) => s.hip[0] + (p[0] - s.hip[0]) * s.turn;
  const bone = (a: [number, number], b: [number, number], color: string, width = 7) => (
    <Line x1={X(a)} y1={a[1]} x2={X(b)} y2={b[1]} stroke={color} strokeWidth={width} strokeLinecap="round" />
  );
  const phoneX = X(s.phone.at);
  const phoneAngle =
    (Math.atan2(Math.sin((s.phone.angle * Math.PI) / 180), Math.cos((s.phone.angle * Math.PI) / 180) * s.turn) * 180) /
    Math.PI;

  return (
    <G>
      {bone(s.hip, s.kneeB, FAR)}
      {bone(s.kneeB, s.footB, FAR)}
      {bone(s.shoulder, s.elbowB, FAR)}
      {bone(s.elbowB, s.handB, FAR)}
      {bone(s.hip, s.shoulder, NEAR, 9)}
      <Circle cx={X(s.head)} cy={s.head[1]} r={11} fill={NEAR} />
      {bone(s.hip, s.kneeF, NEAR)}
      {bone(s.kneeF, s.footF, NEAR)}
      {bone(s.shoulder, s.elbowF, NEAR)}
      {bone(s.elbowF, s.handF, NEAR)}
      <Circle cx={phoneX} cy={s.phone.at[1]} r={13} fill={accent} opacity={0.25} />
      {buzz ? (
        <G>
          <Circle cx={phoneX} cy={s.phone.at[1]} r={19} fill="none" stroke={accent} strokeWidth={2} />
          <Circle cx={phoneX} cy={s.phone.at[1]} r={26} fill="none" stroke={accent} strokeWidth={2} opacity={0.6} />
        </G>
      ) : null}
      <Rect
        x={phoneX - 5}
        y={s.phone.at[1] - 8}
        width={10}
        height={16}
        rx={2}
        fill={accent}
        stroke={colors.bg}
        strokeWidth={1.5}
        transform={`rotate(${phoneAngle - 90} ${phoneX} ${s.phone.at[1]})`}
      />
    </G>
  );
}

/**
 * Animated stick figure showing how to do a test so the sensors read it correctly, with the
 * phone highlighted, a trail of where the phone moves, and step-by-step captions.
 */
export function TechniqueDemo({ sport, accent }: { sport: SportId; accent: string }) {
  const demo = DEMOS[sport];
  const { width } = useWindowDimensions();
  const size = Math.min(260, width - 2 * (space.md * 3));
  const [steps] = useState(() => demo.keys.map((k) => k.step));
  const [keysAt] = useState(() => demo.keys.map((k) => k.at));
  const t = useDemoClock(steps, keysAt);

  const frame = frameAt(demo, t);
  const skeleton = solve(frame.pose, demo.phone);
  const trail = Array.from({ length: TRAIL_STEPS }, (_, i) => {
    const s = solve(frameAt(demo, t - (i + 1) * TRAIL_DT).pose, demo.phone);
    return { x: s.hip[0] + (s.phone.at[0] - s.hip[0]) * s.turn, y: s.phone.at[1], k: i };
  });
  const yaw = frame.pose.yaw ?? 0;
  const turning = yaw > 1 && yaw < 359;
  const headY = skeleton.head[1];

  return (
    <View style={styles.wrap} accessibilityLabel={`How to do it. Step ${frame.step + 1}: ${demo.steps[frame.step]}`}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}>
        <Line x1={0} y1={GROUND_Y + 4} x2={VIEW.w} y2={GROUND_Y + 4} stroke={colors.border} strokeWidth={3} />
        {trail.map((p) => (
          <Circle key={p.k} cx={p.x} cy={p.y} r={4 - p.k * 0.4} fill={accent} opacity={0.5 - p.k * 0.06} />
        ))}
        {turning ? (
          <G>
            <Ellipse
              cx={skeleton.hip[0]}
              cy={skeleton.hip[1] - 4}
              rx={30}
              ry={9}
              fill="none"
              stroke={colors.spin}
              strokeWidth={2.5}
              strokeDasharray="6 5"
            />
            <Path
              d={`M ${skeleton.hip[0] + 24} ${skeleton.hip[1] + 6} l 9 -1 l -4 -8`}
              fill="none"
              stroke={colors.spin}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </G>
        ) : null}
        <Figure s={skeleton} accent={accent} buzz={!!frame.pose.buzz} />
        {frame.say ? (
          <G>
            <Rect
              x={skeleton.head[0] - 46}
              y={Math.max(4, headY - 52)}
              width={92}
              height={26}
              rx={13}
              fill={colors.text}
            />
            <SvgText
              x={skeleton.head[0]}
              y={Math.max(4, headY - 52) + 18}
              fill={colors.bg}
              fontSize={14}
              fontWeight="bold"
              textAnchor="middle"
            >
              {frame.say}
            </SvgText>
          </G>
        ) : null}
      </Svg>

      <View style={styles.dots}>
        {demo.steps.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === frame.step ? accent : colors.border }]} />
        ))}
      </View>
      <Text style={styles.stepNo}>
        STEP {frame.step + 1} OF {demo.steps.length}
      </Text>
      <Text style={styles.caption}>{demo.steps[frame.step]}</Text>
      <View style={styles.avoid}>
        <Text style={styles.avoidText}>⚠️ Avoid: {demo.avoid}</Text>
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendPhone, { backgroundColor: accent }]} />
        <Text style={styles.legendText}>= where the phone goes</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs, alignSelf: 'stretch' },
  dots: { flexDirection: 'row', gap: 6, marginTop: space.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stepNo: { color: colors.muted, fontFamily: fonts.semi, fontSize: 12, letterSpacing: 1.5 },
  caption: { color: colors.text, fontFamily: fonts.semi, fontSize: 16, textAlign: 'center', minHeight: 44 },
  avoid: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    alignSelf: 'stretch',
  },
  avoidText: { color: colors.warn, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendPhone: { width: 8, height: 13, borderRadius: 2 },
  legendText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
});
