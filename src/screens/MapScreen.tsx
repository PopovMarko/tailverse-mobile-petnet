import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {
  Marker,
  type LongPressEvent,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';

import { LocationPrompt } from '../components/LocationPrompt';
import { WalkSpotMarker } from '../components/WalkSpotMarker';
import { WalkSpotSheet } from '../components/WalkSpotSheet';
import { colors } from '../components/form/theme';
import { usePresenceConnection } from '../hooks/usePresenceConnection';
import type { RootTabScreenProps } from '../navigation/types';
import { openAppSettings } from '../services/location';
import { useLocationStore } from '../store/locationStore';
import { useWalkSpotsStore } from '../store/walkSpotsStore';
import type { WalkSpot } from '../types';
import {
  DEFAULT_REGION,
  regionAround,
  regionCenter,
  regionRadiusM,
} from '../utils/geo';

export function MapScreen({ navigation, route }: RootTabScreenProps<'Map'>) {
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(DEFAULT_REGION);
  // animateToRegion is dropped until the native map has laid out, so a move
  // requested before onMapReady waits for it.
  const mapReadyRef = useRef(false);
  const pendingRegionRef = useRef<Region | null>(null);

  const spots = useWalkSpotsStore(state => state.spots);
  const spotsStatus = useWalkSpotsStore(state => state.spotsStatus);
  const spotsError = useWalkSpotsStore(state => state.spotsError);
  const selectedSpotId = useWalkSpotsStore(state => state.selectedSpotId);
  const selectedSpot = useWalkSpotsStore(state => state.selectedSpot);
  const selectedStatus = useWalkSpotsStore(state => state.selectedStatus);
  const selectedError = useWalkSpotsStore(state => state.selectedError);
  const fetchSpots = useWalkSpotsStore(state => state.fetchSpots);
  const selectSpot = useWalkSpotsStore(state => state.selectSpot);
  const clearSelection = useWalkSpotsStore(state => state.clearSelection);

  const permission = useLocationStore(state => state.permission);
  const declined = useLocationStore(state => state.declined);
  const promptDismissed = useLocationStore(state => state.promptDismissed);
  const userPosition = useLocationStore(state => state.userPosition);
  const locating = useLocationStore(state => state.locating);
  const positionError = useLocationStore(state => state.positionError);
  const manualPoint = useLocationStore(state => state.manualPoint);
  const checkPermission = useLocationStore(state => state.checkPermission);
  const requestPermission = useLocationStore(state => state.requestPermission);
  const locate = useLocationStore(state => state.locate);
  const dismissPrompt = useLocationStore(state => state.dismissPrompt);
  const showPrompt = useLocationStore(state => state.showPrompt);
  const setManualPoint = useLocationStore(state => state.setManualPoint);
  const clearManualPoint = useLocationStore(state => state.clearManualPoint);

  const granted = permission === 'granted';

  // Live marker counts (and new walks) over the presence socket.
  const updatesPaused = usePresenceConnection();

  const loadSpotsForRegion = useCallback(
    (region: Region) => {
      regionRef.current = region;
      fetchSpots(regionCenter(region), regionRadiusM(region));
    },
    [fetchSpots],
  );

  /** Animates the map to `region`, or right after onMapReady if it isn't ready yet. */
  const moveMapTo = useCallback((region: Region) => {
    if (mapReadyRef.current) {
      mapRef.current?.animateToRegion(region, 500);
    } else {
      pendingRegionRef.current = region;
    }
  }, []);

  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    const pending = pendingRegionRef.current;
    if (pending) {
      pendingRegionRef.current = null;
      mapRef.current?.animateToRegion(pending, 500);
    }
  }, []);

  // Initial load around the default region; the permission check (no prompt)
  // locates the user if access was granted before.
  useEffect(() => {
    loadSpotsForRegion(DEFAULT_REGION);
    checkPermission();
  }, [loadSpotsForRegion, checkPermission]);

  // Coming back from Settings may have changed the permission.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        checkPermission();
      }
    });
    return () => subscription.remove();
  }, [checkPermission]);

  // Every new fix (start, after "Разрешить", the 📍 button) centres the map on the user.
  // Moving the map fires onRegionChangeComplete, which reloads the spots there.
  useEffect(() => {
    if (userPosition) {
      moveMapTo(regionAround(userPosition));
    }
  }, [userPosition, moveMapTo]);

  // Opened for a spot (e.g. from «Куда пойти»): centre on it and open its card,
  // once. Declared after the effect above so the spot wins over the user's position.
  const focusSpot = route.params?.focusSpot;
  useEffect(() => {
    if (focusSpot) {
      moveMapTo(regionAround(focusSpot));
      selectSpot(focusSpot.id);
      navigation.setParams({ focusSpot: undefined });
    }
  }, [focusSpot, moveMapTo, selectSpot, navigation]);

  const handleMarkerPress = useCallback(
    (spot: WalkSpot) => {
      selectSpot(spot.id);
    },
    [selectSpot],
  );

  const handleMapPress = useCallback(
    (event: MapPressEvent) => {
      // On iOS a marker tap also reaches the map; don't let it close the sheet.
      if (event.nativeEvent.action !== 'marker-press') {
        clearSelection();
      }
    },
    [clearSelection],
  );

  // Manual place selection: works with or without location access.
  const handleLongPress = useCallback(
    (event: LongPressEvent) => {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      setManualPoint({ lat: latitude, lng: longitude });
      clearSelection();
      moveMapTo({ ...regionRef.current, latitude, longitude });
    },
    [setManualPoint, clearSelection, moveMapTo],
  );

  const handleLocatePress = useCallback(() => {
    if (granted) {
      clearManualPoint();
      locate();
    } else {
      clearSelection();
      showPrompt();
    }
  }, [granted, clearManualPoint, locate, clearSelection, showPrompt]);

  const showLocationPrompt =
    permission !== 'unknown' &&
    permission !== 'granted' &&
    !promptDismissed &&
    !selectedSpotId;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        // Only with access: the blue dot must not be what triggers a system prompt.
        showsUserLocation={granted}
        showsMyLocationButton={false}
        onMapReady={handleMapReady}
        onRegionChangeComplete={loadSpotsForRegion}
        onPress={handleMapPress}
        onLongPress={handleLongPress}
      >
        {spots.map(spot => (
          <WalkSpotMarker
            key={spot.id}
            spot={spot}
            selected={spot.id === selectedSpotId}
            onPress={handleMarkerPress}
          />
        ))}
        {manualPoint && (
          <Marker
            identifier="manual-point"
            coordinate={{
              latitude: manualPoint.lat,
              longitude: manualPoint.lng,
            }}
            pinColor={colors.primary}
            title="Выбранное место"
          />
        )}
      </MapView>

      <View style={styles.top} pointerEvents="box-none">
        {spotsStatus === 'loading' && (
          <View style={styles.banner} pointerEvents="none">
            <ActivityIndicator size="small" />
          </View>
        )}

        {spotsStatus === 'error' && (
          <Pressable
            style={[styles.banner, styles.bannerError]}
            onPress={() => loadSpotsForRegion(regionRef.current)}
            accessibilityRole="button"
          >
            <Text style={styles.bannerErrorText}>
              Не удалось загрузить места: {spotsError}
            </Text>
            <Text style={styles.bannerAction}>Нажмите, чтобы повторить</Text>
          </Pressable>
        )}

        {spotsStatus === 'success' && spots.length === 0 && !selectedSpotId && (
          <View style={styles.banner} pointerEvents="none">
            <Text style={styles.bannerText}>Здесь пока нет мест выгула</Text>
          </View>
        )}

        {updatesPaused && (
          <View style={styles.banner} pointerEvents="none">
            <Text style={styles.bannerText}>
              Нет соединения — обновления на паузе
            </Text>
          </View>
        )}

        {granted && positionError && !manualPoint && (
          <View style={styles.banner} pointerEvents="none">
            <Text style={styles.bannerText}>
              Не удалось определить местоположение
            </Text>
          </View>
        )}

        {manualPoint && (
          <View style={[styles.banner, styles.manual]}>
            <Text style={styles.bannerText}>📌 Выбранное место</Text>
            <Pressable
              onPress={clearManualPoint}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Сбросить выбранное место"
            >
              <Text style={styles.bannerAction}>Сбросить</Text>
            </Pressable>
          </View>
        )}
      </View>

      {!selectedSpotId && !showLocationPrompt && (
        <Pressable
          style={styles.locateButton}
          onPress={handleLocatePress}
          accessibilityRole="button"
          accessibilityLabel="Моё местоположение"
        >
          {locating ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text style={styles.locateIcon}>📍</Text>
          )}
        </Pressable>
      )}

      {showLocationPrompt && (
        <LocationPrompt
          permission={permission}
          declined={declined}
          onAllow={requestPermission}
          onOpenSettings={openAppSettings}
          onDismiss={dismissPrompt}
        />
      )}

      {selectedSpotId && (
        <WalkSpotSheet
          spot={selectedSpot}
          status={selectedStatus}
          error={selectedError}
          onClose={clearSelection}
          onRetry={() => selectSpot(selectedSpotId)}
          onPetPress={id => navigation.navigate('PetProfile', { id })}
          onShowPosts={spot =>
            navigation.navigate('Feed', {
              spot: {
                id: spot.id,
                name: spot.name,
                lat: spot.lat,
                lng: spot.lng,
              },
            })
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  top: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    alignItems: 'center',
    gap: 8,
  },
  banner: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#ffffffee',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  bannerText: {
    color: '#424242',
  },
  bannerError: {
    alignSelf: 'stretch',
    backgroundColor: '#ffebee',
  },
  bannerErrorText: {
    color: '#c62828',
  },
  bannerAction: {
    marginTop: 2,
    color: '#1565c0',
    fontWeight: '600',
  },
  manual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locateButton: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  locateIcon: {
    fontSize: 22,
  },
});
