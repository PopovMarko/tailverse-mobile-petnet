import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { type MapPressEvent, type Region } from 'react-native-maps';

import { WalkSpotCard } from '../components/WalkSpotCard';
import { WalkSpotMarker } from '../components/WalkSpotMarker';
import { getCurrentPosition } from '../services/location';
import { useWalkSpotsStore } from '../store/walkSpotsStore';
import type { WalkSpot } from '../types';
import {
  DEFAULT_REGION,
  regionAround,
  regionCenter,
  regionRadiusM,
} from '../utils/geo';

export function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(DEFAULT_REGION);
  // animateToRegion is dropped until the native map has laid out, so centring on
  // the user waits for both onMapReady and the position, whichever comes last.
  const mapReadyRef = useRef(false);
  const pendingUserRegionRef = useRef<Region | null>(null);

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

  const loadSpotsForRegion = useCallback(
    (region: Region) => {
      regionRef.current = region;
      fetchSpots(regionCenter(region), regionRadiusM(region));
    },
    [fetchSpots],
  );

  const centerOnUserIfReady = useCallback(() => {
    const userRegion = pendingUserRegionRef.current;
    if (mapReadyRef.current && userRegion) {
      pendingUserRegionRef.current = null;
      mapRef.current?.animateToRegion(userRegion, 500);
    }
  }, []);

  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    centerOnUserIfReady();
  }, [centerOnUserIfReady]);

  // Initial load around the default region, then move to the user if we can locate them.
  // Moving the map fires onRegionChangeComplete, which reloads the spots there.
  useEffect(() => {
    loadSpotsForRegion(DEFAULT_REGION);

    let cancelled = false;
    getCurrentPosition()
      .then(position => {
        if (!cancelled) {
          pendingUserRegionRef.current = regionAround(position);
          centerOnUserIfReady();
        }
      })
      .catch(() => {
        // Permission declined or location unavailable: stay on the default region.
      });

    return () => {
      cancelled = true;
    };
  }, [loadSpotsForRegion, centerOnUserIfReady]);

  const handleMarkerPress = useCallback(
    (spot: WalkSpot) => {
      selectSpot(spot.id);
    },
    [selectSpot],
  );

  const handleMapPress = useCallback(
    (event: MapPressEvent) => {
      // On iOS a marker tap also reaches the map; don't let it close the card.
      if (event.nativeEvent.action !== 'marker-press') {
        clearSelection();
      }
    },
    [clearSelection],
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton
        onMapReady={handleMapReady}
        onRegionChangeComplete={loadSpotsForRegion}
        onPress={handleMapPress}
      >
        {spots.map(spot => (
          <WalkSpotMarker
            key={spot.id}
            spot={spot}
            selected={spot.id === selectedSpotId}
            onPress={handleMarkerPress}
          />
        ))}
      </MapView>

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

      {selectedSpotId && (
        <WalkSpotCard
          spot={selectedSpot}
          status={selectedStatus}
          error={selectedError}
          onClose={clearSelection}
          onRetry={() => selectSpot(selectedSpotId)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
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
    left: 12,
    right: 12,
    alignSelf: 'auto',
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
});
