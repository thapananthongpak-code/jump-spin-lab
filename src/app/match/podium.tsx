import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { finishMatch } from '@/db/database';
import { rankMatch } from '@/lib/match';
import { SPORTS } from '@/lib/sports';
import { Podium } from '@/components/Podium';
import { ScoreTable } from '@/components/ScoreTable';
import { Body, Button, Card, Label, Screen } from '@/components/ui';
import { useMatch } from '@/state/MatchContext';
import { colors, fonts, playerColor, space } from '@/theme/theme';

export default function MatchResults() {
  const db = useSQLiteContext();
  const { match, clear } = useMatch();
  const matchId = match?.matchId;

  useEffect(() => {
    if (matchId !== undefined) finishMatch(db, matchId).catch(() => {});
  }, [db, matchId]);

  const standings = useMemo(
    () =>
      match
        ? rankMatch(
            match.mode,
            match.slots.flatMap((s) => (s.player ? [{ player: s.player, attempts: s.attempts }] : [])),
          )
        : [],
    [match],
  );

  if (!match) return <Redirect href="/" />;

  const sport = SPORTS[match.mode];
  const winners = standings.filter((s) => s.rank === 1 && s.attempts.length > 0);
  const colorOf = (id: number) => {
    const i = match.slots.findIndex((s) => s.player?.id === id);
    return playerColor(i < 0 ? 0 : i);
  };

  return (
    <Screen>
      <Card style={styles.banner}>
        <Label>
          {sport.icon} {sport.title.toUpperCase()}
        </Label>
        {winners.length === 0 ? (
          <Body style={{ color: colors.muted }}>No valid results in this match</Body>
        ) : (
          <>
            <Text style={styles.trophy}>🏆</Text>
            <Text style={styles.kicker}>{winners.length > 1 ? 'Tie!' : 'Winner'}</Text>
            <Text style={styles.winner} numberOfLines={2}>
              {winners.map((w) => w.player.name).join(' & ')}
            </Text>
          </>
        )}
      </Card>

      {standings.length > 1 ? <Podium standings={standings} sport={sport} /> : null}

      <Label style={{ marginTop: space.sm }}>Scoreboard</Label>
      <ScoreTable standings={standings} sport={sport} colorOf={colorOf} />

      <Button
        label="New match"
        onPress={() => {
          clear();
          router.replace('/match/setup');
        }}
      />
      <Button
        label="Back to home"
        variant="secondary"
        onPress={() => {
          clear();
          router.replace('/');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { alignItems: 'center', paddingVertical: space.lg, borderColor: colors.gold, borderWidth: 2 },
  trophy: { fontSize: 56, lineHeight: 70 },
  kicker: { color: colors.gold, fontFamily: fonts.semi, fontSize: 14, letterSpacing: 3 },
  winner: { color: colors.text, fontFamily: fonts.black, fontSize: 38, lineHeight: 52, textAlign: 'center' },
});
