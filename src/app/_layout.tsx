import { Kanit_400Regular, Kanit_600SemiBold, Kanit_800ExtraBold, Kanit_900Black } from '@expo-google-fonts/kanit';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { DB_NAME, migrate } from '@/db/database';
import { MatchProvider } from '@/state/MatchContext';
import { colors, fonts } from '@/theme/theme';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Kanit_400Regular,
    Kanit_600SemiBold,
    Kanit_800ExtraBold,
    Kanit_900Black,
  });
  // the text fonts are small and bundled, so this wait is brief; if loading fails the
  // system font is used instead of blocking the app
  if (!fontsLoaded && !fontError) return null;

  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
      <MatchProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: fonts.bold, fontSize: 20 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Jump & Spin Lab' }} />
          <Stack.Screen name="measure" options={{ title: 'Solo Jump' }} />
          <Stack.Screen name="players" options={{ title: 'Players' }} />
          <Stack.Screen name="leaderboard" options={{ title: 'Rankings' }} />
          <Stack.Screen name="history" options={{ title: 'History & Stats' }} />
          <Stack.Screen name="debug" options={{ title: 'Sensors (Debug)' }} />
          <Stack.Screen name="match/setup" options={{ title: 'Match Setup' }} />
          <Stack.Screen
            name="match/play"
            options={{ title: 'Match', gestureEnabled: false, headerBackVisible: false }}
          />
          <Stack.Screen
            name="match/podium"
            options={{ title: 'Results', gestureEnabled: false, headerBackVisible: false }}
          />
        </Stack>
      </MatchProvider>
    </SQLiteProvider>
  );
}
