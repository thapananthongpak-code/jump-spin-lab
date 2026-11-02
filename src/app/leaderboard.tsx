import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { AttemptRow, listAttempts, listJumps, listPlayers } from '@/db/database';
import { useFocusLoad } from '@/hooks/useFocusLoad';
import {
  buildLeaderboard,
  buildSportLeaderboard,
  LeaderboardEntry,
  Metric,
  metricUnit,
  QUALIFY_COUNT,
  SportEntry,
} from '@/lib/ranking';
import { SPORTS } from '@/lib/sports';
import { AGE_GROUPS, AgeGroup, GENDERS, Gender, JumpRow, Player, SportId } from '@/lib/types';
import { Body, Button, Card, Chip, EmptyState, Label, Row, Screen } from '@/components/ui';
import { colors, fonts, space } from '@/theme/theme';

const METRICS: { value: Metric; label: string }[] = [
  { value: 'score', label: 'Score' },
  { value: 'height', label: 'Height' },
  { value: 'spin', label: 'Spin' },
  { value: 'relative', label: 'Per body height' },
];

type Tab = 'jump' | 'reaction' | 'throw' | 'balance';
const TABS: { value: Tab; label: string }[] = [
  { value: 'jump', label: '🏀 Jump' },
  { value: 'reaction', label: `${SPORTS.reaction.icon} Start` },
  { value: 'throw', label: `${SPORTS.throw.icon} Throw` },
  { value: 'balance', label: `${SPORTS.balance.icon} Balance` },
];

const MEDALS = ['🥇', '🥈', '🥉'];

function Rank({ rank }: { rank: number | null }) {
  return (
    <Text style={styles.rank} accessibilityLabel={rank ? `Rank ${rank}` : 'Not ranked yet'}>
      {rank ? (MEDALS[rank - 1] ?? rank) : '–'}
    </Text>
  );
}

function JumpEntry({ e, metric }: { e: LeaderboardEntry; metric: Metric }) {
  const fmt = (v: number) => (metric === 'spin' ? String(Math.round(v)) : v.toFixed(1));
  const color = metric === 'spin' ? colors.spin : colors.accent;
  return (
    <Card style={e.qualified ? undefined : { opacity: 0.7 }}>
      <View style={styles.entry}>
        <Rank rank={e.rank} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{e.player.name}</Text>
          <Body style={{ color: colors.muted }}>
            {e.jumps} jumps · best {fmt(e.best)}
          </Body>
          {metric === 'score' ? (
            <Body style={{ color: colors.muted, fontSize: 12 }}>Adjusted for weight, age and sex</Body>
          ) : null}
        </View>
        <Text style={[styles.score, { color }]}>
          {fmt(e.score)}
          <Text style={styles.unit}> {metricUnit(metric)}</Text>
        </Text>
      </View>
    </Card>
  );
}

function SportEntryCard({ e, sport }: { e: SportEntry; sport: SportId }) {
  const def = SPORTS[sport];
  const best = def.format(e.bestAttempt);
  return (
    <Card style={e.qualified ? undefined : { opacity: 0.7 }}>
      <View style={styles.entry}>
        <Rank rank={e.rank} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{e.player.name}</Text>
          <Body style={{ color: colors.muted }}>
            {e.count} attempts · best {best.main}
            {best.sub ? ` / ${best.sub}` : ''} {def.tableUnit}
          </Body>
        </View>
        <Text style={[styles.score, { color: colors.accent }]}>
          {e.score.toFixed(1)}
          <Text style={styles.unit}> pts</Text>
        </Text>
      </View>
    </Card>
  );
}

export default function LeaderboardScreen() {
  const db = useSQLiteContext();
  const [tab, setTab] = useState<Tab>('jump');
  const [metric, setMetric] = useState<Metric>('score');
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | 'all'>('all');

  const [data] = useFocusLoad(
    async () => ({
      players: await listPlayers(db),
      jumps: tab === 'jump' ? await listJumps(db) : ([] as JumpRow[]),
      attempts: tab === 'jump' ? ([] as AttemptRow[]) : await listAttempts(db, tab),
    }),
    { players: [] as Player[], jumps: [] as JumpRow[], attempts: [] as AttemptRow[] },
    [db, tab],
  );

  const filter = useMemo(() => ({ gender, ageGroup }), [gender, ageGroup]);
  const jumpEntries = useMemo(
    () => (tab === 'jump' ? buildLeaderboard(data.players, data.jumps, metric, filter) : []),
    [tab, data, metric, filter],
  );
  const sportEntries = useMemo(
    () =>
      tab === 'jump'
        ? []
        : buildSportLeaderboard(
            tab,
            data.players,
            data.attempts.map((a) => ({ playerId: a.playerId, attempt: a.attempt })),
            filter,
          ),
    [tab, data, filter],
  );

  const entryCount = tab === 'jump' ? jumpEntries.length : sportEntries.length;
  const pendingLabel = `Not enough attempts yet (not ranked)`;

  return (
    <Screen>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TABS.map((t) => (
          <Chip key={t.value} label={t.label} selected={tab === t.value} onPress={() => setTab(t.value)} />
        ))}
      </ScrollView>

      {tab === 'jump' ? (
        <Row>
          {METRICS.map((m) => (
            <Chip key={m.value} label={m.label} selected={metric === m.value} onPress={() => setMetric(m.value)} />
          ))}
        </Row>
      ) : null}

      <Label>Sex</Label>
      <Row>
        <Chip label="All" selected={gender === 'all'} onPress={() => setGender('all')} color={colors.spin} />
        {GENDERS.map((g) => (
          <Chip key={g.value} label={g.label} selected={gender === g.value} onPress={() => setGender(g.value)} color={colors.spin} />
        ))}
      </Row>
      <Label>Age group</Label>
      <Row>
        <Chip label="All" selected={ageGroup === 'all'} onPress={() => setAgeGroup('all')} color={colors.spin} />
        {AGE_GROUPS.map((a) => (
          <Chip key={a.value} label={a.label} selected={ageGroup === a.value} onPress={() => setAgeGroup(a.value)} color={colors.spin} />
        ))}
      </Row>

      <Body style={{ color: colors.muted }}>
        {tab === 'jump'
          ? `Rank = mean of the best ${QUALIFY_COUNT} jumps. You need at least ${QUALIFY_COUNT} jumps to be ranked.${
              metric === 'score' ? '\n"Score" is adjusted for weight, age and sex; the other tabs show measured values.' : ''
            }`
          : `${SPORTS[tab].title}: rank = mean points of the best ${QUALIFY_COUNT} attempts, from Match Mode (one match gives ${SPORTS[tab].rounds} attempts).`}
      </Body>

      {entryCount === 0 ? (
        <EmptyState text="No results in this category yet">
          <Button
            label={tab === 'jump' ? 'Go jump' : 'Start a match'}
            onPress={() => router.push(tab === 'jump' ? '/measure' : '/match/setup')}
          />
        </EmptyState>
      ) : null}

      {tab === 'jump'
        ? (
            <>
              {jumpEntries.filter((e) => e.qualified).map((e) => (
                <JumpEntry key={e.player.id} e={e} metric={metric} />
              ))}
              {jumpEntries.some((e) => !e.qualified) ? (
                <>
                  <Label style={{ marginTop: space.sm }}>{pendingLabel}</Label>
                  {jumpEntries.filter((e) => !e.qualified).map((e) => (
                    <JumpEntry key={e.player.id} e={e} metric={metric} />
                  ))}
                </>
              ) : null}
            </>
          )
        : (
            <>
              {sportEntries.filter((e) => e.qualified).map((e) => (
                <SportEntryCard key={e.player.id} e={e} sport={tab} />
              ))}
              {sportEntries.some((e) => !e.qualified) ? (
                <>
                  <Label style={{ marginTop: space.sm }}>{pendingLabel}</Label>
                  {sportEntries.filter((e) => !e.qualified).map((e) => (
                    <SportEntryCard key={e.player.id} e={e} sport={tab} />
                  ))}
                </>
              ) : null}
            </>
          )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rank: { width: 44, textAlign: 'center', color: colors.text, fontFamily: fonts.black, fontSize: 26 },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 19 },
  score: { fontFamily: fonts.black, fontSize: 26 },
  unit: { color: colors.muted, fontSize: 12, fontFamily: fonts.semi },
});
