import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Pet } from '../types';
import { petSummary } from '../utils/pets';
import { colors } from './form/theme';

interface PetListItemProps {
  pet: Pet;
  /** Opens the pet; without it the item is not tappable. */
  onPress?: (pet: Pet) => void;
}

/** A pet in a list: name, species · breed · age, approximate area. */
export function PetListItem({ pet, onPress }: PetListItemProps) {
  const body = (
    <>
      <View style={styles.texts}>
        <Text style={styles.name}>🐾 {pet.name}</Text>
        <Text style={styles.muted}>{petSummary(pet)}</Text>
        {pet.approx_address ? (
          <Text style={styles.muted}>📍 {pet.approx_address}</Text>
        ) : null}
      </View>
      {onPress && <Text style={styles.chevron}>›</Text>}
    </>
  );

  if (!onPress) {
    return <View style={styles.item}>{body}</View>;
  }
  return (
    <Pressable
      onPress={() => onPress(pet)}
      accessibilityRole="button"
      accessibilityLabel={`Питомец ${pet.name}`}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    gap: 8,
  },
  pressed: {
    backgroundColor: colors.primaryLight,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  muted: {
    color: colors.muted,
  },
  chevron: {
    fontSize: 24,
    color: colors.muted,
  },
});
