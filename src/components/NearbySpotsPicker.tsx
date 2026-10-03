import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { listNearbyWalkSpots, NEARBY_SPOTS_RADIUS_M } from '../api';
import { openAppSettings } from '../services/location';
import { useLocationStore } from '../store/locationStore';
import type { LoadStatus } from '../store/walkSpotsStore';
import type { NearbyWalkSpot } from '../types';
import type { PlaceSpot } from '../utils/announcements';
import { describeError } from '../utils/errors';
import { formatDistance } from '../utils/geo';
import { PrimaryButton } from './form/PrimaryButton';
import { colors } from './form/theme';

interface NearbySpotsPickerProps {
  selected: PlaceSpot | null;
  onSelect: (spot: PlaceSpot) => void;
  /**
   * Switches the form to choosing a point on the map; without it the picker
   * offers only the walk spots (e.g. the place tag of a post).
   */
  onPickOnMap?: () => void;
}

/**
 * Walk spots within 500 m of the user (or of the place picked on the Map tab),
 * closest first. Without a position it explains why and offers the location
 * prompt (and the map, when the form can take a point) instead.
 */
export function NearbySpotsPicker({
  selected,
  onSelect,
  onPickOnMap,
}: NearbySpotsPickerProps) {
  const permission = useLocationStore(state => state.permission);
  const declined = useLocationStore(state => state.declined);
  const userPosition = useLocationStore(state => state.userPosition);
  const manualPoint = useLocationStore(state => state.manualPoint);
  const locating = useLocationStore(state => state.locating);
  const positionError = useLocationStore(state => state.positionError);
  const requestPermission = useLocationStore(state => state.requestPermission);
  const locate = useLocationStore(state => state.locate);

  const center = manualPoint ?? userPosition;
  const [spots, setSpots] = useState<NearbyWalkSpot[]>([]);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const lat = center?.lat;
  const lng = center?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) {
      return;
    }
    let current = true;
    setStatus('loading');
    setError(null);
    listNearbyWalkSpots({ lat, lng })
      .then(response => {
        if (current) {
          setSpots(response.spots);
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

  const mapLink = onPickOnMap ? (
    <PrimaryButton
      title="Выбрать точку на карте"
      variant="secondary"
      onPress={onPickOnMap}
    />
  ) : null;
  // How the texts below point to the map, when there is one.
  const orMap = onPickOnMap ? ' или выберите место на карте' : '';

  if (!center) {
    let message: string;
    let action: ReactNode = null;
    if (permission === 'unknown' || (permission === 'granted' && locating)) {
      return (
        <View style={styles.notice}>
          <ActivityIndicator />
          <Text style={styles.muted}>Определяем местоположение…</Text>
        </View>
      );
    } else if (permission === 'granted') {
      message = `Не удалось определить местоположение${
        positionError ? ` (${positionError})` : ''
      }.`;
      action = (
        <PrimaryButton
          title="Повторить"
          accessibilityLabel="Определить местоположение"
          onPress={locate}
        />
      );
    } else if (permission === 'requestable') {
      message = declined
        ? `Без доступа к геолокации площадки рядом не найти. Разрешите доступ${orMap}.`
        : 'Чтобы показать площадки в пределах 500 м, нужно ваше местоположение. Оно используется только для поиска и никому не показывается.';
      action = (
        <PrimaryButton
          title="Разрешить геолокацию"
          onPress={requestPermission}
        />
      );
    } else if (permission === 'blocked') {
      message = `Доступ к геолокации выключен. Включите его в Настройках${orMap}.`;
      action = (
        <PrimaryButton
          title="Настройки"
          accessibilityLabel="Открыть настройки"
          onPress={openAppSettings}
        />
      );
    } else {
      message = `На этом устройстве нельзя определить местоположение${
        onPickOnMap ? '. Выберите место на карте' : ''
      }.`;
    }
    return (
      <View style={styles.notice}>
        <Text style={styles.body}>📍 {message}</Text>
        {action}
        {mapLink}
      </View>
    );
  }

  // A spot passed in by another screen may be outside the 500 m list.
  const extra =
    selected && !spots.some(spot => spot.id === selected.id) ? selected : null;

  return (
    <View>
      <Text style={styles.caption}>
        Площадки в радиусе {formatDistance(NEARBY_SPOTS_RADIUS_M)}{' '}
        {manualPoint ? 'от выбранного на карте места' : 'от вас'}
      </Text>
      {extra && <SpotRow spot={extra} selected onPress={onSelect} />}
      {status === 'loading' && <ActivityIndicator style={styles.loader} />}
      {status === 'error' && (
        <View style={styles.notice}>
          <Text style={styles.error}>
            Не удалось загрузить площадки: {error}
          </Text>
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
      {status === 'success' && spots.length === 0 && !extra && (
        <View style={styles.notice}>
          <Text style={styles.body}>
            В радиусе {formatDistance(NEARBY_SPOTS_RADIUS_M)} нет площадок для
            выгула.{onPickOnMap ? ' Отметьте место прогулки на карте.' : ''}
          </Text>
          {mapLink}
        </View>
      )}
      {status === 'success' &&
        spots.map(spot => (
          <SpotRow
            key={spot.id}
            spot={spot}
            selected={selected?.id === spot.id}
            onPress={onSelect}
          />
        ))}
    </View>
  );
}

interface SpotRowProps {
  spot: PlaceSpot & { present_count?: number };
  selected: boolean;
  onPress: (spot: PlaceSpot) => void;
}

function SpotRow({ spot, selected, onPress }: SpotRowProps) {
  const details = [
    spot.distance_m !== undefined ? formatDistance(spot.distance_m) : null,
    spot.present_count ? `сейчас гуляют: ${spot.present_count}` : null,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={() =>
        onPress({
          id: spot.id,
          name: spot.name,
          lat: spot.lat,
          lng: spot.lng,
          distance_m: spot.distance_m,
        })
      }
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={spot.name}
      style={[styles.row, selected && styles.rowSelected]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]} />
      <View style={styles.rowText}>
        <Text style={styles.name}>{spot.name}</Text>
        {details.length > 0 && (
          <Text style={styles.muted}>{details.join(' · ')}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  caption: {
    marginBottom: 8,
    color: colors.muted,
  },
  notice: {
    gap: 10,
    paddingVertical: 8,
  },
  body: {
    color: colors.text,
    lineHeight: 20,
  },
  muted: {
    color: colors.muted,
  },
  error: {
    color: colors.error,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
  loader: {
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioSelected: {
    borderWidth: 6,
    borderColor: colors.primary,
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    color: colors.text,
  },
});
