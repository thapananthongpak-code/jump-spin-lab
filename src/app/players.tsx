import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { addPlayer, deletePlayer, listPlayers, PlayerInput, updatePlayer } from '@/db/database';
import { useFocusLoad } from '@/hooks/useFocusLoad';
import { AGE_GROUPS, GENDERS, Player } from '@/lib/types';
import { PlayerForm } from '@/components/PlayerForm';
import { Body, Button, Card, EmptyState, Label, Row, Screen } from '@/components/ui';
import { colors, fonts } from '@/theme/theme';

export default function PlayersScreen() {
  const db = useSQLiteContext();
  const [version, setVersion] = useState(0);
  const [players, loaded] = useFocusLoad(() => listPlayers(db), [] as Player[], [db, version]);
  const [editing, setEditing] = useState<Player | 'new' | null>(null);

  const save = async (input: PlayerInput) => {
    if (editing && editing !== 'new') await updatePlayer(db, editing.id, input);
    else await addPlayer(db, input);
    setEditing(null);
    setVersion((v) => v + 1);
  };

  const confirmDelete = (p: Player) =>
    Alert.alert('Delete player', `Delete "${p.name}" and all of their results?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePlayer(db, p.id);
          setVersion((v) => v + 1);
        },
      },
    ]);

  return (
    <Screen>
      {editing ? (
        <Card>
          <Label>{editing === 'new' ? 'Add player' : 'Edit player'}</Label>
          <PlayerForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? null : editing}
            submitLabel="Save"
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </Card>
      ) : (
        <Button label="＋ Add player" onPress={() => setEditing('new')} />
      )}

      {loaded && players.length === 0 && !editing ? (
        <EmptyState text="No players yet. Tap the button above to add the first one." />
      ) : null}

      {players.map((p) => (
        <Card key={p.id}>
          <View>
            <Text style={styles.name}>{p.name}</Text>
            <Body style={{ color: colors.muted }}>
              {p.age} yrs · {p.heightCm} cm · {p.weightKg} kg · {GENDERS.find((g) => g.value === p.gender)?.label} ·
              group {AGE_GROUPS.find((a) => a.value === p.ageGroup)?.label}
            </Body>
          </View>
          <Row>
            <Button label="Edit" variant="secondary" onPress={() => setEditing(p)} style={{ flex: 1 }} />
            <Button label="Delete" variant="ghost" onPress={() => confirmDelete(p)} style={{ flex: 1 }} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 21 },
});
