import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, {
  type LongPressEvent,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../../components/form/PrimaryButton';
import { colors } from '../../components/form/theme';
import type { RootStackScreenProps } from '../../navigation/types';
import { useLocationStore } from '../../store/locationStore';
import type { GeoPoint } from '../../types';
import { DEFAULT_REGION, regionCenter } from '../../utils/geo';

/** Zoom for placing a point: a few hundred metres across. */
const PICK_DELTA = 0.008;

function regionAt(point: GeoPoint): Region {
  return {
    latitude: point.lat,
    longitude: point.lng,
    latitudeDelta: PICK_DELTA,
    longitudeDelta: PICK_DELTA,
  };
}

/**
 * Choosing the walk's point: the map moves under a fixed pin in the centre (a tap
 * or long press also moves the pin there). "Выбрать эту точку" hands the point
 * back to the announcement form; the Map tab's own chosen place is not touched.
 */
export function PickWalkPointScreen({
  navigation,
  route,
}: RootStackScreenProps<'PickWalkPoint'>) {
  const userPosition = useLocationStore(state => state.userPosition);
  const manualPoint = useLocationStore(state => state.manualPoint);
  const granted = useLocationStore(state => state.permission === 'granted');

  const [initialRegion] = useState<Region>(() => {
    const start = route.params?.initial ?? manualPoint ?? userPosition;
    return start ? regionAt(start) : DEFAULT_REGION;
  });
  const [center, setCenter] = useState<GeoPoint>(() =>
    regionCenter(initialRegion),
  );

  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(initialRegion);
  // animateToRegion is dropped until the native map has laid out (see MapScreen).
  const mapReadyRef = useRef(false);
  const pendingRegionRef = useRef<Region | null>(null);

  const moveMapTo = useCallback((region: Region) => {
    if (mapReadyRef.current) {
      mapRef.current?.animateToRegion(region, 400);
    } else {
      pendingRegionRef.current = region;
    }
  }, []);

  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    const pending = pendingRegionRef.current;
    if (pending) {
      pendingRegionRef.current = null;
      mapRef.current?.animateToRegion(pending, 400);
    }
  }, []);

  const handleRegionChange = useCallback((region: Region) => {
    regionRef.current = region;
    setCenter(regionCenter(region));
  }, []);

  const moveTo = useCallback(
    (point: GeoPoint) => {
      // Keep the zoom; the centre (and so the pin) goes to the point.
      setCenter(point);
      moveMapTo({
        ...regionRef.current,
        latitude: point.lat,
        longitude: point.lng,
      });
    },
    [moveMapTo],
  );

  const handlePress = useCallback(
    (event: MapPressEvent | LongPressEvent) => {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      moveTo({ lat: latitude, lng: longitude });
    },
    [moveTo],
  );

  const confirm = () => {
    navigation.popTo(
      'CreateAnnouncement',
      { pickedPoint: center },
      { merge: true },
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        // Only with access: the blue dot must not be what triggers a system prompt.
        showsUserLocation={granted}
        showsMyLocationButton={false}
        onMapReady={handleMapReady}
        onRegionChangeComplete={handleRegionChange}
        onPress={handlePress}
        onLongPress={handlePress}
      />

      {/* The pin's tip marks the map centre. */}
      <View style={styles.pinLayer} pointerEvents="none">
        <View style={styles.pin}>
          <View style={styles.pinHead} />
          <View style={styles.pinStem} />
        </View>
      </View>

      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText}>
          Двигайте карту, чтобы поставить метку на место прогулки
        </Text>
      </View>

      {userPosition && (
        <Pressable
          style={styles.locateButton}
          onPress={() => moveTo(userPosition)}
          accessibilityRole="button"
          accessibilityLabel="К моему местоположению"
        >
          <Text style={styles.locateIcon}>📍</Text>
        </Pressable>
      )}

      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        <View style={styles.bottomContent}>
          <Text style={styles.coords}>
            {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
          </Text>
          <PrimaryButton title="Выбрать эту точку" onPress={confirm} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const PIN_HEAD = 26;
const PIN_STEM = 16;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pinLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    alignItems: 'center',
    // Lift the pin so its tip, not its middle, is at the centre.
    marginBottom: PIN_HEAD + PIN_STEM,
  },
  pinHead: {
    width: PIN_HEAD,
    height: PIN_HEAD,
    borderRadius: PIN_HEAD / 2,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: colors.primary,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  pinStem: {
    width: 3,
    height: PIN_STEM,
    backgroundColor: colors.primary,
  },
  hint: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#ffffffee',
    alignItems: 'center',
  },
  hintText: {
    color: '#424242',
    textAlign: 'center',
  },
  locateButton: {
    position: 'absolute',
    right: 16,
    bottom: 150,
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
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.background,
  },
  bottomContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  coords: {
    textAlign: 'center',
    color: colors.muted,
  },
});
