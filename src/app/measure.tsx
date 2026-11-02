import { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { bestHeight, deleteJump, insertJump, listPlayers } from '@/db/database';
import { useFocusLoad } from '@/hooks/useFocusLoad';
import { JumpMeasurement } from '@/lib/jumpDetector';
import { Player } from '@/lib/types';
import { formatCm } from '@/lib/format';
import { heightScore } from '@/lib/scoring';
import { Body, Button, Card, Label, Row, Screen } from '@/components/ui';
import { JumpCapture } from '@/components/JumpCapture';
import { PlayerPicker } from '@/components/PlayerPicker';
import { colors, fonts } from '@/theme/theme';

interface Saved {
  id: number;
  isPersonalBest: boolean;
}

export default function MeasureScreen() {
  const db = useSQLiteContext();
  const [players] = useFocusLoad(() => listPlayers(db), [] as Player[], [db]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [session, setSession] = useState<number[]>([]);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [captureKey, setCaptureKey] = useState(0);

  useEffect(() => {
    if (selectedId === null && players.length > 0) setSelectedId(players[0].id);
    if (selectedId !== null && !players.some((p) => p.id === selectedId)) {
      setSelectedId(players[0]?.id ?? null);
    }
  }, [players, selectedId]);

  const player = players.find((p) => p.id === selectedId) ?? null;
  const playerRef = useRef(player);
  playerRef.current = player;
  // the result card appears before the insert finishes, so "delete" waits for this
  const pendingSave = useRef<Promise<Saved | null>>(Promise.resolve(null));

  const onMeasured = useCallback(
    (m: JumpMeasurement) => {
      const p = playerRef.current;
      if (!p) return;
      setSession((s) => [...s, m.heightCm]);
      pendingSave.current = (async () => {
        const previousBest = await bestHeight(db, p.id);
        const id = await insertJump(db, p.id, m);
        const result = { id, isPersonalBest: m.heightCm > previousBest };
        setSaved(result);
        return result;
      })();
    },
    [db],
  );

  const selectPlayer = (id: number) => {
    setSelectedId(id);
    setSession([]);
    setSaved(null);
    setCaptureKey((k) => k + 1);
  };

  return (
    <Screen>
      <PlayerPicker players={players} selectedId={selectedId} onSelect={selectPlayer} />

      {player ? (
        <JumpCapture
          playerName={player.name}
          caption="🏀 Solo Jump"
          resetKey={captureKey}
          scoreFor={(m) => heightScore(m.heightCm, player)}
          onMeasured={onMeasured}
          renderDone={(m, retry) => (
            <>
              {saved?.isPersonalBest ? (
                <Card style={{ borderColor: colors.gold }}>
                  <Text style={{ color: colors.gold, fontSize: 20, fontFamily: fonts.bold, textAlign: 'center' }}>
                    🎉 New personal best for {player.name}!
                  </Text>
                </Card>
              ) : null}
              <Button
                label="Jump again"
                onPress={() => {
                  setSaved(null);
                  retry();
                }}
              />
              <Row>
                <Button
                  label="Delete this jump"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={async () => {
                    const s = await pendingSave.current;
                    if (s) await deleteJump(db, s.id);
                    setSession((s) => s.slice(0, -1));
                    setSaved(null);
                    retry();
                  }}
                />
                <Button label="View history" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/history')} />
              </Row>
              <Body style={{ color: colors.muted, textAlign: 'center' }}>
                Saved automatically · results are estimates, ±1–3 cm
              </Body>
            </>
          )}
        />
      ) : null}

      {session.length > 0 ? (
        <Card>
          <Label>This session ({session.length} jumps)</Label>
          <Body>{session.map((h) => formatCm(h)).join(' · ')} cm</Body>
          <Body style={{ color: colors.muted }}>
            Best {formatCm(Math.max(...session))} cm · average {formatCm(session.reduce((a, b) => a + b, 0) / session.length)} cm
          </Body>
        </Card>
      ) : null}
    </Screen>
  );
}
