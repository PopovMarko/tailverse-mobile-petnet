import { StyleSheet, Text, View } from 'react-native';

import { FormScreen } from '../../components/form/FormScreen';
import { PrimaryButton } from '../../components/form/PrimaryButton';
import { colors } from '../../components/form/theme';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import type { Pet } from '../../types';
import { formatAge } from '../../utils/date';
import { speciesLabel } from '../../utils/pets';

function PetRow({ pet }: { pet: Pet }) {
  const details = [
    speciesLabel(pet.species),
    pet.breed,
    pet.age !== null ? formatAge(pet.age) : null,
  ].filter(Boolean);

  return (
    <View style={styles.pet}>
      <Text style={styles.petName}>{pet.name}</Text>
      <Text style={styles.muted}>{details.join(' · ')}</Text>
      <Text style={styles.muted}>📍 {pet.approx_address}</Text>
    </View>
  );
}

/** Last onboarding step: the pets added so far, add another or finish. */
export function OnboardingPetsScreen({
  navigation,
}: RootStackScreenProps<'OnboardingPets'>) {
  const pets = useAuthStore(state => state.pets);
  const finishOnboarding = useAuthStore(state => state.finishOnboarding);

  return (
    <FormScreen>
      <Text style={styles.intro}>
        Все питомцы будут собраны в вашем профиле. Можно добавить ещё или
        перейти в приложение.
      </Text>
      {pets.map(pet => (
        <PetRow key={pet.id} pet={pet} />
      ))}
      <PrimaryButton
        title="Добавить ещё питомца"
        variant="secondary"
        onPress={() => navigation.push('AddPet')}
        style={styles.button}
      />
      <PrimaryButton
        title="Готово"
        onPress={finishOnboarding}
        disabled={pets.length === 0}
        style={styles.button}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: 16,
    color: colors.muted,
    lineHeight: 20,
  },
  pet: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    gap: 2,
  },
  petName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  muted: {
    color: colors.muted,
  },
  button: {
    marginTop: 12,
  },
});
