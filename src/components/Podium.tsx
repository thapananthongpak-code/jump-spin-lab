import { StyleSheet, Text, View } from 'react-native';
import { Standing } from '@/lib/match';
import { SportDef } from '@/lib/sports';
import { colors, fonts, space } from '@/theme/theme';

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = [colors.gold, colors.silver, colors.bronze];
const BLOCK_HEIGHT = [128, 96, 72];

/** Classic podium order: 2nd | 1st | 3rd (2nd | 1st for two players). */
function podiumOrder(n: number): number[] {
  return n >= 3 ? [1, 0, 2] : n === 2 ? [1, 0] : [0];
}

export function Podium({ standings, sport }: { standings: Standing[]; sport: SportDef }) {
  const order = podiumOrder(standings.length).filter((i) => standings[i]);
  return (
    <View style={styles.wrap}>
      {order.map((i) => {
        const s = standings[i];
        const r = Math.min(s.rank, 3) - 1;
        const best = s.bestAttempt ? sport.format(s.bestAttempt) : null;
        return (
          <View key={s.player.id} style={styles.col}>
            <Text style={styles.medal}>{MEDALS[r]}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {s.player.name}
            </Text>
            <Text style={styles.value}>
              {best ? `${best.main}${best.sub ? ` · ${best.sub}` : ''}` : '–'}
            </Text>
            <View style={[styles.block, { height: BLOCK_HEIGHT[r], backgroundColor: MEDAL_COLORS[r] }]}>
              <Text style={styles.blockRank}>{s.rank}</Text>
              <Text style={styles.points}>{s.attempts.length ? s.bestScore.toFixed(1) : '–'} pts</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: space.sm, paddingTop: space.md },
  col: { flex: 1, maxWidth: 130, alignItems: 'center', gap: 2 },
  medal: { fontSize: 36 },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  value: { color: colors.muted, fontFamily: fonts.semi, fontSize: 13 },
  block: { alignSelf: 'stretch', borderTopLeftRadius: 12, borderTopRightRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  blockRank: { color: colors.onAccent, fontFamily: fonts.black, fontSize: 36, lineHeight: 44 },
  points: { color: colors.onAccent, fontFamily: fonts.semi, fontSize: 12 },
});
