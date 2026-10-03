import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { LoadStatus } from '../store/walkSpotsStore';
import type { WalkSpotDetails } from '../types';

interface WalkSpotCardProps {
  spot: WalkSpotDetails | null;
  status: LoadStatus;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}

/** Bottom card with the selected spot's details and who is there now. */
export function WalkSpotCard({
  spot,
  status,
  error,
  onClose,
  onRetry,
}: WalkSpotCardProps) {
  return (
    <View style={styles.card}>
      <Pressable
        style={styles.close}
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Закрыть"
      >
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      {status === 'loading' && <ActivityIndicator style={styles.loader} />}

      {status === 'error' && (
        <View>
          <Text style={styles.error}>Не удалось загрузить место: {error}</Text>
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Text style={styles.link}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {status === 'success' && spot && (
        <View>
          <Text style={styles.name}>{spot.name}</Text>

          {spot.tags.length > 0 && (
            <View style={styles.tags}>
              {spot.tags.map(tag => (
                <Text key={tag} style={styles.tag}>
                  {tag}
                </Text>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>
            Сейчас здесь: {spot.present.length}
          </Text>
          {spot.present.length === 0 ? (
            <Text style={styles.muted}>Пока никого нет</Text>
          ) : (
            spot.present.map(pet => (
              <Text key={pet.pet_id} style={styles.pet}>
                🐶 {pet.pet_name}{' '}
                <Text style={styles.muted}>· {pet.owner_nickname}</Text>
              </Text>
            ))
          )}
        </View>
      )}
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
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  close: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 1,
  },
  closeText: {
    fontSize: 18,
    color: '#757575',
  },
  loader: {
    paddingVertical: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 24,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#eeeeee',
    color: '#424242',
  },
  sectionTitle: {
    marginTop: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  pet: {
    paddingVertical: 2,
  },
  muted: {
    color: '#757575',
  },
  error: {
    color: '#c62828',
    marginRight: 24,
  },
  link: {
    marginTop: 8,
    color: '#1565c0',
    fontWeight: '600',
  },
});
