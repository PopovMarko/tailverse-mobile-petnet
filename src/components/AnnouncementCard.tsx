import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';

import type { SpotInfo } from '../store/announcementsStore';
import type { Announcement } from '../types';
import {
  WALK_PHASE_LABELS,
  walkPhase,
  type WalkPhase,
} from '../utils/announcements';
import { formatDateTime, formatDuration } from '../utils/date';
import { colors } from './form/theme';

/** Place of a walk for display: the spot's name or "Точка на карте". */
export function placeLabel(
  announcement: Pick<Announcement, 'spot_id'>,
  spots: Record<string, SpotInfo | null>,
): string {
  if (!announcement.spot_id) {
    return 'Точка на карте';
  }
  return spots[announcement.spot_id]?.name ?? 'Площадка';
}

interface AnnouncementCardProps {
  announcement: Announcement;
  petName: string | null;
  place: string;
  /** The walk is led by one of the signed-in owner's pets. */
  mine: boolean;
  now: Date;
  onPress: (announcement: Announcement) => void;
}

/** One walk in the "Иду гулять" list: pet, place, start, duration, status. */
export function AnnouncementCard({
  announcement,
  petName,
  place,
  mine,
  now,
  onPress,
}: AnnouncementCardProps) {
  const phase = walkPhase(announcement, now);
  const start = new Date(announcement.starts_at);
  const name = petName ?? 'Питомец';

  return (
    <Pressable
      onPress={() => onPress(announcement)}
      accessibilityRole="button"
      accessibilityLabel={`Прогулка: ${name}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <Text style={styles.pet} numberOfLines={1}>
          🐾 {name}
          {mine && <Text style={styles.mine}> · ваш питомец</Text>}
        </Text>
        <Text style={[styles.badge, BADGE_STYLES[phase]]}>
          {WALK_PHASE_LABELS[phase]}
        </Text>
      </View>
      <Text style={styles.line} numberOfLines={1}>
        {announcement.spot_id ? '📍' : '📌'} {place}
      </Text>
      <Text style={styles.line}>
        🕒 {formatDateTime(start, now)} ·{' '}
        {formatDuration(announcement.duration_min)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: colors.background,
    gap: 4,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pet: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  mine: {
    fontWeight: '400',
    color: colors.primary,
  },
  line: {
    color: '#424242',
  },
  badge: {
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  upcoming: {
    color: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  ongoing: {
    color: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  ended: {
    color: colors.muted,
    backgroundColor: colors.surface,
  },
  cancelled: {
    color: colors.error,
    backgroundColor: colors.errorLight,
  },
});

const BADGE_STYLES: Record<WalkPhase, TextStyle> = {
  upcoming: styles.upcoming,
  ongoing: styles.ongoing,
  ended: styles.ended,
  cancelled: styles.cancelled,
};
