import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { createMatch } from '@/db/database';
import { MAX_PLAYERS, MIN_PLAYERS } from '@/lib/match';
import { CATEGORY_LABEL, SPORT_LIST, SPORTS, SportCategory } from '@/lib/sports';
import { SportId } from '@/lib/types';
import { TechniqueDemo } from '@/components/TechniqueDemo';
import { Body, Button, Card, Label, Screen } from '@/components/ui';
import { useMatch } from '@/state/MatchContext';
import { colors, fonts, playerColor, radius, space } from '@/theme/theme';

const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

export default function MatchSetup() {
  const db = useSQLiteContext();
  const { start } = useMatch();
  const params = useLocalSearchParams<{ sport?: string }>();
  const [mode, setMode] = useState<SportId>(
    params.sport && params.sport in SPORTS ? (params.sport as SportId) : 'height',
  );
  const sport = SPORTS[mode];
  const [count, setCount] = useState(2);
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    setBusy(true);
    try {
      const matchId = await createMatch(db, mode, sport.rounds);
      start({ matchId, mode, playerCount: count });
      router.replace('/match/play');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Label>1 · Choose a sport</Label>
      {(Object.keys(CATEGORY_LABEL) as SportCategory[]).map((cat) => (
        <View key={cat} style={{ gap: space.sm }}>
          <Text style={styles.category}>{CATEGORY_LABEL[cat]}</Text>
          {SPORT_LIST.filter((m) => m.category === cat).map((m) => {
            const selected = m.id === mode;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setMode(m.id)}
                style={[styles.mode, selected && { borderColor: colors.accent, backgroundColor: colors.cardAlt }]}
              >
                <Text style={styles.modeIcon}>{m.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeTitle}>{m.title}</Text>
                  <Body style={{ color: colors.muted }}>{m.blurb}</Body>
                  <Text style={styles.sensors}>{m.sensors} · {m.rounds} rounds</Text>
                </View>
                <View style={[styles.radio, selected && { borderColor: colors.accent }]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Card>
        <Label>How to do {sport.title} right</Label>
        <TechniqueDemo sport={mode} accent={colors.accent} />
      </Card>

      <Label style={{ marginTop: space.sm }}>2 · Number of players</Label>
      <View style={styles.counts}>
        {COUNTS.map((n) => {
          const selected = n === count;
          return (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${n} players`}
              onPress={() => setCount(n)}
              style={[styles.count, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}
            >
              <Text style={[styles.countNumber, selected && { color: colors.onAccent }]}>{n}</Text>
              <Text style={[styles.countUnit, selected && { color: colors.onAccent }]}>players</Text>
              <View style={styles.lanes}>
                {Array.from({ length: n }, (_, i) => (
                  <View key={i} style={[styles.lane, { backgroundColor: playerColor(i) }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.rules}>
        <Body style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>
          Players take turns, {sport.rounds} rounds each. The first player enters their details and plays all{' '}
          {sport.rounds} rounds, then passes the phone on. A scoreboard follows at the end.{'\n'}
          The score uses the <Text style={{ color: colors.text }}>best round</Text> and is adjusted to each player;
          measured values are shown as measured.{'\n'}
          <Text style={{ color: colors.text }}>Where the phone goes:</Text> {sport.placement}
        </Body>
      </View>

      <Button label={`Start with ${count} players`} onPress={begin} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    minHeight: 76,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  modeIcon: { fontSize: 34 },
  category: { color: colors.muted, fontFamily: fonts.semi, fontSize: 14, letterSpacing: 1.5 },
  sensors: { color: colors.spin, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  modeTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  counts: { flexDirection: 'row', gap: space.sm },
  count: {
    flex: 1,
    minHeight: 112,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  countNumber: { color: colors.text, fontFamily: fonts.black, fontSize: 44, lineHeight: 54 },
  countUnit: { color: colors.muted, fontFamily: fonts.semi, fontSize: 14, marginTop: -6 },
  lanes: { flexDirection: 'row', gap: 3, marginTop: 6 },
  lane: { width: 10, height: 6, borderRadius: 3 },
  rules: { backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: colors.border },
});
