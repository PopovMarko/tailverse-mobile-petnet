import { useRef } from 'react';
import type { TextInputInstance } from 'react-native';

import type { DateString } from '../types';
import { ageInYears, formatAge } from '../utils/date';
import {
  KNOWN_SPECIES,
  type PetFormErrors,
  type PetFormValues,
  type SpeciesChoice,
} from '../utils/pets';
import {
  APPROX_ADDRESS_MAX,
  BREED_MAX,
  PET_NAME_MAX,
  SPECIES_MAX,
} from '../utils/validation';
import { ChoiceChips, type Choice } from './form/ChoiceChips';
import { DateField } from './form/DateField';
import { FormField } from './form/FormField';

const SPECIES_OPTIONS: Choice<SpeciesChoice>[] = [
  ...KNOWN_SPECIES,
  { value: 'other', label: 'Другое' },
];

interface PetFormFieldsProps {
  values: PetFormValues;
  errors: PetFormErrors;
  onChange: (changes: Partial<PetFormValues>) => void;
  /**
   * Whether a set birth date may be removed. The backend can only set or change
   * it, so editing a pet that has one keeps it.
   */
  birthDateClearable?: boolean;
}

/** The fields of a pet profile, shared by adding (AddPet) and editing (EditPet) a pet. */
export function PetFormFields({
  values,
  errors,
  onChange,
  birthDateClearable = true,
}: PetFormFieldsProps) {
  const breedRef = useRef<TextInputInstance>(null);
  const age = values.birthDate ? ageInYears(values.birthDate) : null;

  let birthHint: string;
  if (age !== null) {
    birthHint = `Возраст: ${formatAge(age)}`;
  } else {
    birthHint = 'Необязательно — по ней считается возраст';
  }
  if (!birthDateClearable && values.birthDate) {
    birthHint += '. Дату можно изменить, но не удалить';
  }

  return (
    <>
      <FormField
        label="Кличка"
        value={values.name}
        onChangeText={name => onChange({ name })}
        error={errors.name}
        maxLength={PET_NAME_MAX}
        returnKeyType="next"
        onSubmitEditing={() => breedRef.current?.focus()}
        submitBehavior="submit"
      />
      <ChoiceChips
        label="Вид"
        options={SPECIES_OPTIONS}
        value={values.species}
        onChange={species => onChange({ species })}
        error={errors.species}
      />
      {values.species === 'other' ? (
        <FormField
          label="Какой вид?"
          value={values.customSpecies}
          onChangeText={customSpecies => onChange({ customSpecies })}
          error={errors.customSpecies}
          placeholder="Например, хорёк"
          maxLength={SPECIES_MAX}
        />
      ) : null}
      <FormField
        ref={breedRef}
        label="Порода"
        value={values.breed}
        onChangeText={breed => onChange({ breed })}
        error={errors.breed}
        placeholder="Например, корги или метис"
        maxLength={BREED_MAX}
        returnKeyType="next"
      />
      <DateField
        label="Дата рождения"
        value={values.birthDate}
        onChange={(birthDate: DateString | null) => onChange({ birthDate })}
        maximumDate={new Date()}
        clearable={birthDateClearable}
        hint={birthHint}
      />
      <FormField
        label="Район"
        value={values.approxAddress}
        onChangeText={approxAddress => onChange({ approxAddress })}
        error={errors.approxAddress}
        hint="Примерный район, где вы живёте, — без точного адреса"
        placeholder="Например, Хамовники, Москва"
        maxLength={APPROX_ADDRESS_MAX}
        returnKeyType="done"
      />
    </>
  );
}
