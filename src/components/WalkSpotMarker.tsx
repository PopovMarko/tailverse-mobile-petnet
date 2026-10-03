import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { WalkSpot } from '../types';

interface WalkSpotMarkerProps {
  spot: WalkSpot;
  selected: boolean;
  onPress: (spot: WalkSpot) => void;
}

/** Map pin for a walk spot: a bubble with the number of pets there right now. */
export function WalkSpotMarker({
  spot,
  selected,
  onPress,
}: WalkSpotMarkerProps) {
  const active = spot.present_count > 0;

  return (
    <Marker
      identifier={spot.id}
      coordinate={{ latitude: spot.lat, longitude: spot.lng }}
      onPress={() => onPress(spot)}
      // The bubble only changes with these props; skip per-frame re-snapshots.
      tracksViewChanges={false}
      key={`${spot.id}:${spot.present_count}:${selected}`}
    >
      <View
        style={[
          styles.bubble,
          active && styles.bubbleActive,
          selected && styles.bubbleSelected,
        ]}
      >
        <Text style={[styles.count, active && styles.countActive]}>
          🐾 {spot.present_count}
        </Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  bubble: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#9e9e9e',
  },
  bubbleActive: {
    borderColor: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  bubbleSelected: {
    borderColor: '#1565c0',
    transform: [{ scale: 1.15 }],
  },
  count: {
    fontSize: 13,
    fontWeight: '600',
    color: '#424242',
  },
  countActive: {
    color: '#1b5e20',
  },
});
