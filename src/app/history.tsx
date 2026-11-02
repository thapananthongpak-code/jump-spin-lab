import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { AttemptRow, deleteAttempt, deleteJump, listAttempts, listJumps, listPlayers } from '@/db/database';
import { useFocusLoad } from '@/hooks/useFocusLoad';
import { formatCm, formatDateTime, formatDeg } from '@/lib/format';
import { SPORTS } from '@/lib/sports';
import { JumpRow, Player } from '@/lib/types';
import { LineChart } from '@/components/LineChart';
import { PlayerPicker } from '@/components/PlayerPicker';
import { Body, Button, Card, Chip, EmptyState, Label, Row, Screen, Stat } from '@/components/ui';
import { colors, fonts, space } from '@/theme/theme';

type Tab = 'jump' | 'reaction' | 'throw' | 'balance';
const TABS: { value: Tab; label: string }[] = [
  { value: 'jump', label: '🏀 Jump' },
  { value: 'reaction', label: `${SPORTS.reaction.icon} Start` },
  { value: 'throw', label: `${SPORTS.throw.icon} Throw` },
  { value: 'balance', label: `${SPORTS.balance.icon} Balance` },
];

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Tab>('jump');
  const [players] = useFocusLoad(() => listPlayers(db), [] as Player[], [db]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (players.length > 0 && !players.some((p) => p.id === selectedId)) setSelectedId(players[0].id);
  }, [players, selectedId]);

  const player = players.find((p) => p.id === selectedId) ?? null;

  return (
    <Screen>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TABS.map((t) => (
          <Chip key={t.value} label={t.label} selected={tab === t.value} onPress={() => setTab(t.value)} />
        ))}
      </ScrollView>
      <PlayerPicker players={players} selectedId={selectedId} onSelect={setSelectedId} />

      {selectedId !== null && player ? (
        tab === 'jump' ? (
          <JumpHistory playerId={selectedId} version={version} bump={() => setVersion((v) => v + 1)} />
        ) : (
          <SportHistory sport={tab} player={player} version={version} bump={() => setVersion((v) => v + 1)} />
        )
      ) : null}
    </Screen>
  );
}

function JumpHistory({ playerId, version, bump }: { playerId: number; version: number; bump: () => void }) {
  const db = useSQLiteContext();
  const [jumps] = useFocusLoad(() => listJumps(db, playerId), [] as JumpRow[], [db, playerId, version]);

  const heights = jumps.map((j) => j.heightCm);
  const best = heights.length ? Math.max(...heights) : 0;
  const avg = heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : 0;
  const bestSpin = jumps.length ? Math.max(...jumps.map((j) => j.spinDeg)) : 0;
  const recent = jumps.slice(-30);

  const confirmDelete = (j: JumpRow) =>
    Alert.alert('Delete this jump?', `${formatCm(j.heightCm)} cm (${formatDateTime(j.createdAt)})`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteJump(db, j.id);
          bump();
        },
      },
    ]);

  if (jumps.length === 0) {
    return (
      <EmptyState text="No jumps recorded for this player yet">
        <Button label="Go jump" onPress={() => router.push('/measure')} />
      </EmptyState>
    );
  }

  return (
    <>
      <Card>
        <Row>
          <Stat label="Personal best" value={formatCm(best)} unit="cm" color={colors.gold} />
          <Stat label="Average" value={formatCm(avg)} unit="cm" />
        </Row>
        <Row>
          <Stat label="Attempts" value={String(jumps.length)} />
          <Stat label="Most spin" value={formatDeg(bestSpin)} unit="°" color={colors.spin} />
        </Row>
      </Card>

      <Card>
        <Label>Progress (last {recent.length} jumps)</Label>
        <LineChart values={recent.map((j) => j.heightCm)} min={0} />
      </Card>

      <Label>All results (long-press to delete)</Label>
      {jumps
        .slice()
        .reverse()
        .map((j) => (
          <Pressable
            key={j.id}
            onLongPress={() => confirmDelete(j)}
            accessibilityHint="Long-press to delete"
            style={styles.item}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemMain}>{formatCm(j.heightCm)} cm</Text>
              <Body style={{ color: colors.muted }}>
                {formatDateTime(j.createdAt)}
                {j.matchId ? ' · match' : ''}
              </Body>
            </View>
            <Text style={[styles.itemSide, { color: colors.spin }]}>{formatDeg(j.spinDeg)}°</Text>
          </Pressable>
        ))}
    </>
  );
}

function SportHistory({
  sport,
  player,
  version,
  bump,
}: {
  sport: Exclude<Tab, 'jump'>;
  player: Player;
  version: number;
  bump: () => void;
}) {
  const db = useSQLiteContext();
  const def = SPORTS[sport];
  const [rows] = useFocusLoad(() => listAttempts(db, sport, player.id), [] as AttemptRow[], [db, sport, player.id, version]);

  const scores = rows.map((r) => def.score(r.attempt, player));
  const best = scores.length ? Math.max(...scores) : 0;
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const bestRow = rows.length ? rows[scores.indexOf(best)] : null;
  const bestFmt = bestRow ? def.format(bestRow.attempt) : null;

  const confirmDelete = (r: AttemptRow) =>
    Alert.alert('Delete this attempt?', formatDateTime(r.createdAt), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAttempt(db, r.id);
          bump();
        },
      },
    ]);

  if (rows.length === 0) {
    return (
      <EmptyState text={`No ${def.title} results for this player yet (they come from Match Mode)`}>
        <Button label="Start a match" onPress={() => router.push('/match/setup')} />
      </EmptyState>
    );
  }

  return (
    <>
      <Card>
        <Row>
          <Stat label="Best score" value={best.toFixed(1)} unit="pts" color={colors.gold} />
          <Stat label="Average score" value={avg.toFixed(1)} unit="pts" />
        </Row>
        <Row>
          <Stat label="Attempts" value={String(rows.length)} />
          <Stat
            label={`Measured, best attempt (${def.tableUnit})`}
            value={bestFmt ? `${bestFmt.main}${bestFmt.sub ? ` / ${bestFmt.sub}` : ''}` : '–'}
            color={colors.spin}
          />
        </Row>
      </Card>

      <Card>
        <Label>Score progress (last {Math.min(rows.length, 30)})</Label>
        <LineChart values={scores.slice(-30)} min={0} />
      </Card>

      <Label>All results (long-press to delete)</Label>
      {rows
        .map((r, i) => ({ r, score: scores[i] }))
        .reverse()
        .map(({ r, score }) => {
          const f = def.format(r.attempt);
          return (
            <Pressable
              key={r.id}
              onLongPress={() => confirmDelete(r)}
              accessibilityHint="Long-press to delete"
              style={styles.item}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemMain, r.attempt.foul && { color: colors.danger }]}>
                  {f.main}
                  {f.sub ? ` / ${f.sub}` : ''}
                </Text>
                <Body style={{ color: colors.muted }}>
                  {formatDateTime(r.createdAt)}
                  {r.matchId ? ' · match' : ''}
                </Body>
              </View>
              <Text style={[styles.itemSide, { color: colors.accent }]}>{score.toFixed(1)}</Text>
            </Pressable>
          );
        })}
    </>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: space.md,
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemMain: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  itemSide: { fontFamily: fonts.bold, fontSize: 20 },
});
