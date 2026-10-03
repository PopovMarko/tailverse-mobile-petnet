import { StyleSheet, Text, View } from 'react-native';

import type { LocationPermission } from '../services/location';
import { PrimaryButton } from './form/PrimaryButton';
import { colors } from './form/theme';

interface LocationPromptProps {
  permission: Exclude<LocationPermission, 'granted'>;
  /** The user has just declined the system prompt. */
  declined: boolean;
  onAllow: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
}

const MANUAL_HINT =
  'Двигайте карту или удерживайте палец на нужном месте, чтобы выбрать его вручную.';
const MANUAL_HINT_LOWER =
  'двигайте карту или удерживайте палец на нужном месте, чтобы выбрать его вручную.';

/**
 * Explains why location helps before the system prompt is shown, and what to do
 * without it. The system prompt is only triggered by "Разрешить".
 */
export function LocationPrompt({
  permission,
  declined,
  onAllow,
  onOpenSettings,
  onDismiss,
}: LocationPromptProps) {
  let title: string;
  let body: string;
  if (permission === 'unavailable') {
    title = 'Геолокация недоступна';
    body = `На этом устройстве нельзя определить местоположение. ${MANUAL_HINT}`;
  } else if (permission === 'blocked' || declined) {
    title = 'Карта работает и без геолокации';
    body =
      permission === 'blocked'
        ? `${MANUAL_HINT} Если передумаете, доступ можно включить в Настройках.`
        : MANUAL_HINT;
  } else {
    title = 'Показать места рядом с вами?';
    body =
      'С доступом к геолокации карта откроется там, где вы: с ближайшими местами выгула и питомцами, которые гуляют сейчас. Местоположение нужно только для поиска мест и никому не показывается. ' +
      `Можно и без него: ${MANUAL_HINT_LOWER}`;
  }

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.title}>📍 {title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.actions}>
        {permission === 'requestable' && (
          <PrimaryButton
            title="Разрешить"
            onPress={onAllow}
            style={styles.button}
          />
        )}
        {permission === 'blocked' && (
          <PrimaryButton
            title="Настройки"
            accessibilityLabel="Открыть настройки"
            onPress={onOpenSettings}
            style={styles.button}
          />
        )}
        <PrimaryButton
          title={
            permission === 'requestable' && !declined ? 'Не сейчас' : 'Понятно'
          }
          variant="secondary"
          onPress={onDismiss}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.background,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    marginTop: 6,
    color: colors.text,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  button: {
    flex: 1,
    minHeight: 44,
  },
});
