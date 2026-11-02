import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space } from '@/theme/theme';

/** Dots for round progress: filled = done, ringed = the round being played. */
export function RoundDots({
  total,
  done,
  color,
}: {
  total: number;
  done: number;
  color: string;
}) {
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityLabel={done >= total ? `All ${total} rounds done` : `Round ${done + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const filled = i < done;
        const current = i === done;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              { borderColor: filled || current ? color : colors.border },
              filled && { backgroundColor: color },
              current && { borderWidth: 3 },
            ]}
          />
        );
      })}
    </View>
  );
}

/** Athlete-card style strip: lane colour, bib number, name and an optional right-hand slot. */
export function SportHeader({
  tag,
  name,
  caption,
  color,
  right,
}: {
  tag?: string;
  name: string;
  caption?: string;
  color: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={[styles.header, { borderLeftColor: color }]}>
      {tag ? (
        <View style={[styles.bib, { backgroundColor: color }]}>
          <Text style={styles.bibText}>{tag}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderLeftWidth: 8,
    paddingVertical: space.sm + 4,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bib: {
    minWidth: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  bibText: { color: colors.onAccent, fontFamily: fonts.black, fontSize: 22, lineHeight: 30 },
  caption: { color: colors.muted, fontFamily: fonts.semi, fontSize: 12, letterSpacing: 1 },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 24, lineHeight: 32 },
});
