import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { PlayerInput } from '@/db/database';
import { GENDERS, Gender, Player } from '@/lib/types';
import { Body, Button, Chip, Label, Row } from './ui';
import { colors, fonts, radius, space } from '@/theme/theme';

interface Props {
  initial?: Player | null;
  submitLabel: string;
  /** colour of the primary button (lane colour in a match) */
  accent?: string;
  onSubmit: (input: PlayerInput) => void | Promise<void>;
  onCancel?: () => void;
}

const num = (s: string) => Number(s.replace(',', '.').trim());

export function PlayerForm({ initial, submitLabel, accent, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [age, setAge] = useState(initial ? String(initial.age) : '');
  const [height, setHeight] = useState(initial ? String(initial.heightCm) : '');
  const [weight, setWeight] = useState(initial ? String(initial.weightKg) : '');
  const [gender, setGender] = useState<Gender>(initial?.gender ?? 'male');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const input = {
      name: name.trim(),
      age: Math.round(num(age)),
      heightCm: num(height),
      weightKg: num(weight),
      gender,
    };
    if (!input.name) return setError('Please enter a name');
    if (!Number.isFinite(input.age) || input.age < 6 || input.age > 90) {
      return setError('Age must be between 6 and 90');
    }
    if (!Number.isFinite(input.heightCm) || input.heightCm < 100 || input.heightCm > 230) {
      return setError('Height must be between 100 and 230 cm');
    }
    if (!Number.isFinite(input.weightKg) || input.weightKg < 20 || input.weightKg > 200) {
      return setError('Weight must be between 20 and 200 kg');
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(input);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Nickname"
        placeholderTextColor={colors.muted}
        maxLength={16}
        style={styles.input}
        accessibilityLabel="Nickname"
      />
      <View style={styles.trio}>
        <Field label="Age (years)" value={age} onChange={setAge} keyboard="number-pad" max={2} />
        <Field label="Height (cm)" value={height} onChange={setHeight} keyboard="decimal-pad" max={5} />
        <Field label="Weight (kg)" value={weight} onChange={setWeight} keyboard="decimal-pad" max={5} />
      </View>
      <Label>Sex (used to adjust scores and split rankings)</Label>
      <Row>
        {GENDERS.map((g) => (
          <Chip key={g.value} label={g.label} selected={gender === g.value} onPress={() => setGender(g.value)} />
        ))}
      </Row>
      <Body style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
        Age, weight and sex are used to make scores fair. Measured values are always shown as measured.
      </Body>
      {error ? <Body style={{ color: colors.danger }}>{error}</Body> : null}
      <Button label={submitLabel} onPress={submit} disabled={busy} color={accent} />
      {onCancel ? <Button label="Cancel" variant="ghost" onPress={onCancel} /> : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboard,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboard: 'number-pad' | 'decimal-pad';
  max: number;
}) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Label>{label}</Label>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        maxLength={max}
        style={[styles.input, { textAlign: 'center' }]}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    color: colors.text,
    paddingHorizontal: space.md,
    fontSize: 18,
    fontFamily: fonts.semi,
  },
  trio: { flexDirection: 'row', gap: space.sm },
});
