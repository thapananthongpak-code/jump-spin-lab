import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Card, Label, Screen } from '@/components/ui';
import { colors, fonts, playerColors, radius, space } from '@/theme/theme';

function BigTile({
  icon,
  title,
  subtitle,
  onPress,
  primary,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        primary
          ? { backgroundColor: colors.accent }
          : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={styles.tileIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tileTitle, primary && { color: colors.onAccent }]}>{title}</Text>
        <Text style={[styles.tileSub, primary && { color: colors.onAccent }]}>{subtitle}</Text>
      </View>
      <Text style={[styles.chevron, primary && { color: colors.onAccent }]}>›</Text>
    </Pressable>
  );
}

function SmallTile({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.small, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.smallLabel}>{title}</Text>
    </Pressable>
  );
}

export default function Home() {
  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.lanes}>
          {playerColors.map((c) => (
            <View key={c} style={[styles.lane, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={styles.heroTitle}>JUMP{'\n'}& SPIN LAB</Text>
        <Body style={{ color: colors.muted }}>
          Measure your body with the accelerometer and gyroscope: jump, spin, sprint start, throw and balance, then compete fairly.
        </Body>
      </View>

      <BigTile
        primary
        icon="🏀"
        title="Solo Jump"
        subtitle="Measure your height, spin and score"
        onPress={() => router.push('/measure')}
      />
      <BigTile
        icon="🏆"
        title="Match Mode"
        subtitle="5 sports · 2–4 players take turns · scoreboard"
        onPress={() => router.push('/match/setup')}
      />

      <View style={styles.grid}>
        <SmallTile title="🥇 Rankings" onPress={() => router.push('/leaderboard')} />
        <SmallTile title="📈 History" onPress={() => router.push('/history')} />
        <SmallTile title="👥 Players" onPress={() => router.push('/players')} />
        <SmallTile title="🔧 Sensors" onPress={() => router.push('/debug')} />
      </View>

      <Card>
        <Label>How is scoring fair?</Label>
        <Body style={{ color: colors.muted }}>
          Measured values are always shown as measured, but points are adjusted to each player. High jump uses
          leg power from body weight (Sayers 1999 equation); sprint start, throw and balance are adjusted for age (and sex). 100 points =
          the reference value of that sport. Most factors and references are the app's own estimates, not published
          norms, and every measurement has some error.
        </Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm, paddingTop: space.sm },
  lanes: { flexDirection: 'row', gap: 6 },
  lane: { height: 8, flex: 1, borderRadius: 4 },
  heroTitle: { color: colors.text, fontFamily: fonts.black, fontSize: 46, lineHeight: 52, letterSpacing: 1 },
  tile: {
    borderRadius: radius.lg,
    padding: space.lg,
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  tileIcon: { fontSize: 38 },
  tileTitle: { color: colors.text, fontFamily: fonts.black, fontSize: 26, lineHeight: 34 },
  tileSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  chevron: { color: colors.muted, fontSize: 34 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  small: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallLabel: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
});
