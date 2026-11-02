import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { CUE_MS } from './reaction';

// The phone is in a pocket while jumping, so results are spoken and felt, not only shown.

export function speak(text: string): void {
  try {
    Speech.stop();
    Speech.speak(text, { language: 'en-US', rate: 1.0 });
  } catch {
    // speech is a nicety; never break a measurement because of it
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {}
}

export function tick(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function success(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function warn(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/**
 * The start cue of a reaction race: as strong as the phone allows but over within CUE_MS, so
 * the reaction detector never mistakes the buzz for the player moving.
 * Android: one continuous motor buzz. iOS ignores vibration lengths, so three heavy taps in a row.
 */
export function cue(): void {
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate(CUE_MS);
      return;
    }
    const heavy = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    heavy();
    setTimeout(heavy, CUE_MS / 3);
    setTimeout(heavy, (2 * CUE_MS) / 3);
  } catch {}
}
