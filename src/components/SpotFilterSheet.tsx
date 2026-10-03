import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { listWalkSpots } from '../api';
import { useLocationStore } from '../store/locationStore';
import type { LoadStatus } from '../store/walkSpotsStore';
import type { Id, WalkSpot } from '../types';
import { describeError } from '../utils/errors';
import {
  DEFAULT_REGION,
  distanceM,
  formatDistance,
  regionCenter,
} from '../utils/geo';
import { BottomSheet } from './BottomSheet';
import { colors } from './form/theme';

/** How far around the user the feed filter lists places. */
export const FILTER_SPOTS_RADIUS_M = 20_000;

const DEFAULT_CENTER = regionCenter(DEFAULT_REGION);

interface SpotFilterSheetProps {
  /** The place the feed is filtered by now, if any. */
  selectedId: Id | null;
  /** A place was chosen; null — the whole feed. */
  onSelect: (spot: WalkSpot | null) => void;
  onClose: () => void;
}

/**
 * Bottom sheet for filtering the feed by a walk spot: the places around the user
 * (or the place picked on the map, or the city centre), closest first.
 */
export function SpotFilterSheet({
  selectedId,
  onSelect,
  onClose,
}: SpotFilterSheetProps) {
  const manualPoint = useLocationStore(state => state.manualPoint);
  const userPosition = useLocationStore(state => state.userPosition);
  const center = manualPoint ?? userPosition ?? DEFAULT_CENTER;
  const centerSource = manualPoint
    ? 'от выбранного на карте места'
    : userPosition
    ? 'от вас'
    : 'от центра города';

  const [spots, setSpots] = useState<(WalkSpot & { distance: number })[]>([]);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const { lat, lng } = center;
  useEffect(() => {
    let current = true;
    setStatus('loading');
    setError(null);
    listWalkSpots({ lat, lng }, FILTER_SPOTS_RADIUS_M)
      .then(response => {
        if (current) {
          setSpots(
            response.spots
              .map(spot => ({
                ...spot,
                distance: distanceM(spot, { lat, lng }),
              }))
              .sort((a, b) => a.distance - b.distance),
          );
          setStatus('success');
        }
      })
      .catch(loadError => {
        if (current) {
          setError(describeError(loadError));
          setStatus('error');
        }
      });
    return () => {
      current = false;
    };
  }, [lat, lng, attempt]);

  const header = (
    <View>
      <Text style={styles.title}>Посты о месте</Text>
      <Text style={styles.muted}>
        Места в радиусе {formatDistance(FILTER_SPOTS_RADIUS_M)} {centerSource}
      </Text>
    </View>
  );

  return (
    <BottomSheet header={header} onClose={onClose} maxHeightRatio={0.7}>
      <Row
        title="Все места"
        details="Вся лента"
        selected={selectedId === null}
        onPress={() => onSelect(null)}
      />
      {status === 'loading' && <ActivityIndicator style={styles.loader} />}
      {status === 'error' && (
        <View style={styles.notice}>
          <Text style={styles.error}>Не удалось загрузить места: {error}</Text>
          <Pressable
            onPress={() => setAttempt(value => value + 1)}
            accessibilityRole="button"
            accessibilityLabel="Повторить"
            hitSlop={8}
          >
            <Text style={styles.link}>Повторить</Text>
          </Pressable>
        </View>
      )}
      {status === 'success' && spots.length === 0 && (
        <Text style={[styles.muted, styles.notice]}>
          Рядом пока нет мест для выгула.
        </Text>
      )}
      {status === 'success' &&
        spots.map(spot => (
          <Row
            key={spot.id}
            title={spot.name}
            details={formatDistance(spot.distance)}
            selected={selectedId === spot.id}
            onPress={() => onSelect(spot)}
          />
        ))}
    </BottomSheet>
  );
}

interface RowProps {
  title: string;
  details: string;
  selected: boolean;
  onPress: () => void;
}

function Row({ title, details, selected, onPress }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      style={[styles.row, selected && styles.rowSelected]}
    >
      <View style={styles.rowText}>
        <Text style={styles.name}>📍 {title}</Text>
        <Text style={styles.muted}>{details}</Text>
      </View>
      {selected && <Text style={styles.check}>✓</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginRight: 28,
  },
  muted: {
    color: colors.muted,
  },
  loader: {
    paddingVertical: 16,
  },
  notice: {
    gap: 8,
    paddingVertical: 8,
  },
  error: {
    color: colors.error,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    color: colors.text,
  },
  check: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
});
