import { StyleSheet, Text, View } from 'react-native';
import { Standing } from '@/lib/match';
import { Formatted, SportDef } from '@/lib/sports';
import { colors, fonts, space } from '@/theme/theme';

const FOUL_COLOR = '#FF6B6B';

/** Scoreboard: real measured values per round, the best one, and the adjusted points. */
export function ScoreTable({
  standings,
  sport,
  colorOf,
}: {
  standings: Standing[];
  sport: SportDef;
  /** lane colour per player id */
  colorOf: (playerId: number, fallbackIndex: number) => string;
}) {
  const rounds = sport.rounds;
  const unit = sport.tableUnit;
  return (
    <View style={styles.table} accessibilityRole="summary">
      <View style={[styles.row, styles.head]}>
        <Text style={[styles.th, styles.cRank]}>#</Text>
        <Text style={[styles.th, styles.cName]}>Player</Text>
        {Array.from({ length: rounds }, (_, i) => (
          <Text key={i} style={[styles.th, styles.cRound]}>
            R{i + 1}
          </Text>
        ))}
        <Text style={[styles.th, styles.cBest]}>Best</Text>
        <Text style={[styles.th, styles.cPts]}>Pts</Text>
      </View>

      {standings.map((s, idx) => {
        const lane = colorOf(s.player.id, idx);
        const bestIdx = s.bestAttempt ? s.scores.indexOf(s.bestScore) : -1;
        const best: Formatted | null = s.bestAttempt ? sport.format(s.bestAttempt) : null;
        return (
          <View key={s.player.id} style={[styles.row, { borderLeftColor: lane }]}>
            <Text style={[styles.rank, styles.cRank]}>{s.rank}</Text>
            <Text style={[styles.name, styles.cName]} numberOfLines={1}>
              {s.player.name}
            </Text>
            {Array.from({ length: rounds }, (_, i) => {
              const a = s.attempts[i];
              const t = a ? sport.format(a) : null;
              return (
                <View key={i} style={styles.cRound}>
                  <Text
                    style={[
                      styles.cell,
                      i === bestIdx && { color: colors.accent },
                      a?.foul && { color: FOUL_COLOR },
                    ]}
                  >
                    {t?.main ?? '–'}
                  </Text>
                  {t?.sub ? <Text style={styles.sub}>{t.sub}</Text> : null}
                </View>
              );
            })}
            <View style={styles.cBest}>
              <Text style={[styles.cell, { fontFamily: fonts.bold }]}>{best?.main ?? '–'}</Text>
              {best?.sub ? <Text style={styles.sub}>{best.sub}</Text> : null}
            </View>
            <Text style={[styles.pts, styles.cPts]}>{s.attempts.length ? s.bestScore.toFixed(1) : '–'}</Text>
          </View>
        );
      })}
      <Text style={styles.foot}>
        R = measured value of each round ({unit}) · Pts = score adjusted for weight, age and sex (100 = reference)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  table: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: 6,
    paddingRight: space.sm,
    paddingLeft: 6,
    borderLeftWidth: 6,
    borderLeftColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  head: { backgroundColor: colors.cardAlt, minHeight: 36, borderTopWidth: 0 },
  th: { color: colors.muted, fontFamily: fonts.semi, fontSize: 12, letterSpacing: 0.5, textAlign: 'center' },
  cRank: { width: 26, textAlign: 'center' },
  cName: { flex: 1, minWidth: 58, paddingHorizontal: 4 },
  cRound: { width: 44, alignItems: 'center' },
  cBest: { width: 52, alignItems: 'center' },
  cPts: { width: 50, textAlign: 'right' },
  rank: { color: colors.text, fontFamily: fonts.black, fontSize: 20 },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  cell: { color: colors.text, fontFamily: fonts.semi, fontSize: 14, textAlign: 'center' },
  sub: { color: colors.spin, fontFamily: fonts.regular, fontSize: 11 },
  pts: { color: colors.accent, fontFamily: fonts.black, fontSize: 17 },
  foot: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, padding: space.sm + 2, lineHeight: 18 },
});
