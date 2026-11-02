import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  addPlayer,
  bestHeight,
  getPlayer,
  insertAttempt,
  insertJump,
  listPlayers,
  PlayerInput,
  updatePlayer,
} from '@/db/database';
import { useFocusLoad } from '@/hooks/useFocusLoad';
import { rankMatch } from '@/lib/match';
import { Attempt, SPORTS, usesJumpDetector } from '@/lib/sports';
import { Player } from '@/lib/types';
import { CountUp } from '@/components/CountUp';
import { SportCapture } from '@/components/capture/SportCapture';
import { PlayerForm } from '@/components/PlayerForm';
import { ScoreTable } from '@/components/ScoreTable';
import { SportHeader } from '@/components/SportHeader';
import { Body, Button, Card, EmptyState, Label, Screen } from '@/components/ui';
import { useMatch } from '@/state/MatchContext';
import { colors, fonts, playerColor, radius, space } from '@/theme/theme';

export default function MatchPlay() {
  const db = useSQLiteContext();
  const { match, setPlayer, addAttempt, next, clear } = useMatch();
  const [showSummary, setShowSummary] = useState(false);
  const current = match?.current ?? 0;

  useEffect(() => setShowSummary(false), [current]);

  if (!match) return <Redirect href="/match/setup" />;

  const sport = SPORTS[match.mode];
  const slot = match.slots[match.current];
  const lane = playerColor(match.current);
  const tag = `P${match.current + 1}`;
  const isLast = match.current === match.slots.length - 1;
  const player = slot.player;
  const rounds = sport.rounds;

  const leave = () =>
    Alert.alert('Leave the match?', 'Results played so far stay in History, but this match will have no final scoreboard.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          clear();
          router.replace('/');
        },
      },
    ]);

  const leaveButton = <Button label="Leave match" variant="ghost" onPress={leave} />;

  // 1 · registration -------------------------------------------------------
  if (!player) {
    return (
      <Screen>
        <SportHeader
          tag={tag}
          color={lane}
          caption={`Player ${match.current + 1} of ${match.slots.length} · ${sport.icon} ${sport.title}`}
          name="Player details"
        />
        <Register
          lane={lane}
          takenIds={match.slots.flatMap((s) => (s.player ? [s.player.id] : []))}
          onReady={async (p) => {
            const previousBest = usesJumpDetector(sport.id) ? await bestHeight(db, p.id) : 0;
            setPlayer(match.current, p, previousBest);
          }}
        />
        {leaveButton}
      </Screen>
    );
  }

  // 3 · summary after the last round ---------------------------------------
  if (showSummary || slot.attempts.length >= rounds) {
    const finished = match.slots.filter((s) => s.player && s.attempts.length > 0);
    const standings = rankMatch(
      match.mode,
      finished.map((s) => ({ player: s.player!, attempts: s.attempts })),
    );
    const mine = standings.find((s) => s.player.id === player.id)!;
    const colorOf = (id: number) => {
      const i = match.slots.findIndex((s) => s.player?.id === id);
      return playerColor(i < 0 ? 0 : i);
    };
    const nextSlotNumber = match.current + 2;
    const best = mine.bestAttempt ? sport.format(mine.bestAttempt) : null;
    return (
      <Screen>
        <SportHeader tag={tag} color={lane} caption="Player summary" name={player.name} />
        <View style={[styles.summary, { borderColor: lane }]}>
          <Text style={styles.sumLabel}>Score (best round)</Text>
          <CountUp value={mine.bestScore} decimals={1} duration={1100} style={[styles.sumPoints, { color: lane }]} />
          <Text style={styles.sumUnit}>pts</Text>
          {best ? (
            <Text style={styles.sumReal}>
              Measured {best.main}
              {best.sub ? ` · ${best.sub}` : ''} ({sport.tableUnit})
            </Text>
          ) : null}
          <Text style={styles.sumRank}>
            Currently #{mine.rank} of {standings.length} players so far
          </Text>
        </View>

        <Label>Standings so far</Label>
        <ScoreTable standings={standings} sport={sport} colorOf={colorOf} />

        <Button
          label={isLast ? 'See final results 🏆' : `Pass the phone to player ${nextSlotNumber} ▶`}
          color={isLast ? colors.accent : playerColor(match.current + 1)}
          onPress={() => {
            if (isLast) router.replace('/match/podium');
            else next();
          }}
        />
      </Screen>
    );
  }

  // 2 · playing -------------------------------------------------------------
  const onAttempt = async (a: Attempt, raw?: Parameters<typeof insertJump>[2]) => {
    addAttempt(match.current, a);
    if (usesJumpDetector(sport.id) && raw) await insertJump(db, player.id, raw, match.matchId);
    else await insertAttempt(db, player.id, sport.id, a, match.matchId);
  };

  const roundsDone = slot.attempts.length;
  // the result card is only shown for the latest attempt, which is already in slot.attempts
  const priorBest = Math.max(slot.previousBestCm, ...slot.attempts.slice(0, -1).map((j) => j.value));

  return (
    <Screen>
      <SportCapture
        sport={sport}
        player={player}
        caption={`${sport.icon} ${sport.title} · Player ${match.current + 1}/${match.slots.length}`}
        tag={tag}
        accent={lane}
        rounds={{ total: rounds, done: roundsDone }}
        resetKey={match.current}
        onAttempt={onAttempt}
        renderDone={(a, retry) => {
          const hasHistory = slot.previousBestCm > 0 || roundsDone > 1;
          const isPb =
            sport.id === 'height' && hasHistory && a.value > priorBest + 1e-9;
          const allDone = roundsDone >= rounds;
          return (
            <>
              {isPb ? (
                <View style={styles.pb}>
                  <Text style={styles.pbText}>🎉 NEW PB!</Text>
                </View>
              ) : null}
              {allDone ? (
                <Button label="See my summary" color={lane} onPress={() => setShowSummary(true)} />
              ) : (
                <Button label={`Next round (${roundsDone + 1}/${rounds}) ▶`} color={lane} onPress={retry} />
              )}
            </>
          );
        }}
      />
      {leaveButton}
    </Screen>
  );
}

/** Pick a saved player (and confirm their details) or add a new one. */
function Register({
  lane,
  takenIds,
  onReady,
}: {
  lane: string;
  takenIds: number[];
  onReady: (p: Player) => Promise<void>;
}) {
  const db = useSQLiteContext();
  const [players] = useFocusLoad(() => listPlayers(db), [] as Player[], [db]);
  const [editing, setEditing] = useState<Player | 'new' | null>(null);
  const available = useMemo(() => players.filter((p) => !takenIds.includes(p.id)), [players, takenIds]);

  if (editing) {
    const initial = editing === 'new' ? null : editing;
    return (
      <Card>
        <Label>{initial ? `Check ${initial.name}'s details (edit if anything changed)` : 'New player'}</Label>
        <PlayerForm
          initial={initial}
          accent={lane}
          submitLabel="Confirm and play ▶"
          onCancel={() => setEditing(null)}
          onSubmit={async (input: PlayerInput) => {
            const id = initial ? initial.id : await addPlayer(db, input);
            if (initial) await updatePlayer(db, id, input);
            const saved = await getPlayer(db, id);
            if (saved) await onReady(saved);
          }}
        />
      </Card>
    );
  }

  return (
    <>
      <Button label="＋ New player" color={lane} onPress={() => setEditing('new')} />
      {available.length > 0 ? <Label>Or pick a saved player</Label> : null}
      {available.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          onPress={() => setEditing(p)}
          style={({ pressed }) => [styles.saved, { borderLeftColor: lane }, pressed && { opacity: 0.8 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.savedName}>{p.name}</Text>
            <Body style={{ color: colors.muted }}>
              {p.age} yrs · {p.heightCm} cm · {p.weightKg} kg
            </Body>
          </View>
          <Text style={{ color: colors.muted, fontSize: 22 }}>›</Text>
        </Pressable>
      ))}
      {players.length === 0 ? (
        <EmptyState text="No saved players yet. Tap the button above to enter the first player." />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: space.lg,
    alignItems: 'center',
    gap: 2,
  },
  sumLabel: { color: colors.muted, fontFamily: fonts.semi, fontSize: 13, letterSpacing: 1 },
  sumPoints: { fontFamily: fonts.black, fontSize: 84, lineHeight: 100, includeFontPadding: false },
  sumUnit: { color: colors.muted, fontFamily: fonts.semi, fontSize: 18, marginTop: -6 },
  sumReal: { color: colors.text, fontFamily: fonts.semi, fontSize: 16, marginTop: space.sm, textAlign: 'center' },
  sumRank: { color: colors.accent, fontFamily: fonts.bold, fontSize: 16, marginTop: 4 },
  pb: { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: space.sm, alignItems: 'center' },
  pbText: { color: colors.onAccent, fontFamily: fonts.black, fontSize: 22, lineHeight: 30 },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
    paddingHorizontal: space.md,
  },
  savedName: { color: colors.text, fontFamily: fonts.bold, fontSize: 19 },
});
