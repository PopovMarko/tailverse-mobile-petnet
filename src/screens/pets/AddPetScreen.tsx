import { useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { TextInputInstance } from 'react-native';

import { ChoiceChips, type Choice } from '../../components/form/ChoiceChips';
import { DateField } from '../../components/form/DateField';
import { FormField } from '../../components/form/FormField';
import { FormScreen } from '../../components/form/FormScreen';
import { PrimaryButton } from '../../components/form/PrimaryButton';
import { colors } from '../../components/form/theme';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import type { DateString } from '../../types';
import { ageInYears, formatAge } from '../../utils/date';
import { describeError } from '../../utils/errors';
import { KNOWN_SPECIES } from '../../utils/pets';
import {
  APPROX_ADDRESS_MAX,
  BREED_MAX,
  PET_NAME_MAX,
  SPECIES_MAX,
  validateRequired,
} from '../../utils/validation';

type SpeciesChoice = (typeof KNOWN_SPECIES)[number]['value'] | 'other';

const SPECIES_OPTIONS: Choice<SpeciesChoice>[] = [
  ...KNOWN_SPECIES,
  { value: 'other', label: 'Другое' },
];

interface PetErrors {
  name?: string | null;
  species?: string | null;
  customSpecies?: string | null;
  breed?: string | null;
  approxAddress?: string | null;
}

/**
 * Adds a pet to the signed-in owner (POST /pets). Used in onboarding; also
 * reusable from the main stack: after saving it goes back if it can.
 */
export function AddPetScreen({ navigation }: RootStackScreenProps<'AddPet'>) {
  const addPet = useAuthStore(state => state.addPet);
  const isFirstPet = useAuthStore(state => state.pets.length === 0);

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<SpeciesChoice | null>(null);
  const [customSpecies, setCustomSpecies] = useState('');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState<DateString | null>(null);
  const [approxAddress, setApproxAddress] = useState('');

  const [errors, setErrors] = useState<PetErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const breedRef = useRef<TextInputInstance>(null);

  const age = birthDate ? ageInYears(birthDate) : null;

  const submit = async () => {
    const nextErrors: PetErrors = {
      name: validateRequired(name, PET_NAME_MAX, 'Введите кличку'),
      species: species ? null : 'Выберите вид',
      customSpecies:
        species === 'other'
          ? validateRequired(customSpecies, SPECIES_MAX, 'Укажите вид')
          : null,
      breed: validateRequired(breed, BREED_MAX, 'Укажите породу (или «метис»)'),
      approxAddress: validateRequired(
        approxAddress,
        APPROX_ADDRESS_MAX,
        'Укажите район',
      ),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || !species) {
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await addPet({
        name: name.trim(),
        species: species === 'other' ? customSpecies.trim() : species,
        breed: breed.trim(),
        birth_date: birthDate,
        approx_address: approxAddress.trim(),
      });
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('OnboardingPets');
      }
    } catch (error) {
      setFormError(describeError(error));
      setSubmitting(false);
    }
  };

  return (
    <FormScreen>
      {isFirstPet ? (
        <Text style={styles.intro}>
          Питомец — главный герой Tailverse. Расскажите о нём: его профиль
          увидят другие владельцы. Питомцев можно добавить несколько.
        </Text>
      ) : null}

      <FormField
        label="Кличка"
        value={name}
        onChangeText={setName}
        error={errors.name}
        maxLength={PET_NAME_MAX}
        returnKeyType="next"
        onSubmitEditing={() => breedRef.current?.focus()}
        submitBehavior="submit"
      />
      <ChoiceChips
        label="Вид"
        options={SPECIES_OPTIONS}
        value={species}
        onChange={setSpecies}
        error={errors.species}
      />
      {species === 'other' ? (
        <FormField
          label="Какой вид?"
          value={customSpecies}
          onChangeText={setCustomSpecies}
          error={errors.customSpecies}
          placeholder="Например, хорёк"
          maxLength={SPECIES_MAX}
        />
      ) : null}
      <FormField
        ref={breedRef}
        label="Порода"
        value={breed}
        onChangeText={setBreed}
        error={errors.breed}
        placeholder="Например, корги или метис"
        maxLength={BREED_MAX}
        returnKeyType="next"
      />
      <DateField
        label="Дата рождения"
        value={birthDate}
        onChange={setBirthDate}
        maximumDate={new Date()}
        hint={
          age !== null
            ? `Возраст: ${formatAge(age)}`
            : 'Необязательно — по ней считается возраст'
        }
      />
      <FormField
        label="Район"
        value={approxAddress}
        onChangeText={setApproxAddress}
        error={errors.approxAddress}
        hint="Примерный район, где вы живёте, — без точного адреса"
        placeholder="Например, Хамовники, Москва"
        maxLength={APPROX_ADDRESS_MAX}
        returnKeyType="done"
      />

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <PrimaryButton
        title="Сохранить питомца"
        onPress={submit}
        loading={submitting}
        style={styles.submit}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: 20,
    color: colors.muted,
    lineHeight: 20,
  },
  formError: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
    color: colors.error,
    backgroundColor: colors.errorLight,
  },
  submit: {
    marginTop: 12,
  },
});
