import * as Haptics from 'expo-haptics';
import { getSettings } from '@/storage/settings';

export async function feedbackSuccess(): Promise<void> {
  if (!getSettings().haptics) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export async function feedbackWarning(): Promise<void> {
  if (!getSettings().haptics) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export async function feedbackTap(): Promise<void> {
  if (!getSettings().haptics) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export async function feedbackHeavy(): Promise<void> {
  if (!getSettings().haptics) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
