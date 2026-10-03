import { StyleSheet, Text } from 'react-native';

import { PetListItem } from '../../components/PetListItem';
import { FormScreen } from '../../components/form/FormScreen';
import { PrimaryButton } from '../../components/form/PrimaryButton';
import { colors } from '../../components/form/theme';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';

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
        <PetListItem key={pet.id} pet={pet} />
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
  button: {
    marginTop: 12,
  },
});
