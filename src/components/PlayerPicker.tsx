import { ScrollView } from 'react-native';
import { Player } from '@/lib/types';
import { Chip, EmptyState, Button } from './ui';
import { router } from 'expo-router';

export function PlayerPicker({
  players,
  selectedId,
  onSelect,
}: {
  players: Player[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (players.length === 0) {
    return (
      <EmptyState text="No players yet. Add a player before measuring.">
        <Button label="Add player" onPress={() => router.push('/players')} />
      </EmptyState>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {players.map((p) => (
        <Chip key={p.id} label={p.name} selected={p.id === selectedId} onPress={() => onSelect(p.id)} />
      ))}
    </ScrollView>
  );
}
