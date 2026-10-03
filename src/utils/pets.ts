import { ApiError } from '../api/client';
import type {
  DateString,
  Pet,
  PetCreateRequest,
  PetUpdateRequest,
} from '../types';
import { ageInYears, formatAge } from './date';
import { describeError } from './errors';
import {
  APPROX_ADDRESS_MAX,
  BREED_MAX,
  PET_NAME_MAX,
  SPECIES_MAX,
  validateRequired,
} from './validation';

/** Species the app offers as quick choices; any other value is free text. */
export const KNOWN_SPECIES = [
  { value: 'dog', label: 'Собака' },
  { value: 'cat', label: 'Кошка' },
] as const;

/** Russian name for a species value from the backend ("dog" → "Собака"). */
export function speciesLabel(species: string): string {
  const known = KNOWN_SPECIES.find(item => item.value === species);
  if (known) {
    return known.label;
  }
  return species ? species.charAt(0).toUpperCase() + species.slice(1) : '';
}

/** Full years of the pet, counted from its birth date (null — no birth date). */
export function petAge(pet: Pick<Pet, 'birth_date' | 'age'>, now?: Date) {
  return pet.birth_date ? ageInYears(pet.birth_date, now) ?? pet.age : null;
}

/** One line about a pet: "Собака · корги · 3 года". */
export function petSummary(
  pet: Pick<Pet, 'species' | 'breed' | 'birth_date' | 'age'>,
  now?: Date,
): string {
  const age = petAge(pet, now);
  return [
    speciesLabel(pet.species),
    pet.breed,
    age !== null ? formatAge(age) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A quick species choice of the pet form, or "other" with free text. */
export type SpeciesChoice = (typeof KNOWN_SPECIES)[number]['value'] | 'other';

/** What the pet form (adding and editing a pet) holds. */
export interface PetFormValues {
  name: string;
  species: SpeciesChoice | null;
  /** The species typed in when `species` is "other". */
  customSpecies: string;
  breed: string;
  birthDate: DateString | null;
  approxAddress: string;
}

export interface PetFormErrors {
  name?: string | null;
  species?: string | null;
  customSpecies?: string | null;
  breed?: string | null;
  approxAddress?: string | null;
}

export const EMPTY_PET_FORM: PetFormValues = {
  name: '',
  species: null,
  customSpecies: '',
  breed: '',
  birthDate: null,
  approxAddress: '',
};

/** The form filled with a pet's current data (a species other than dog/cat is free text). */
export function petToFormValues(pet: Pet): PetFormValues {
  const known = KNOWN_SPECIES.find(item => item.value === pet.species);
  return {
    name: pet.name,
    species: known ? known.value : 'other',
    customSpecies: known ? '' : pet.species,
    breed: pet.breed,
    birthDate: pet.birth_date,
    approxAddress: pet.approx_address,
  };
}

/** Client-side checks of the pet form (the same for adding and editing). */
export function validatePetForm(values: PetFormValues): PetFormErrors {
  return {
    name: validateRequired(values.name, PET_NAME_MAX, 'Введите кличку'),
    species: values.species ? null : 'Выберите вид',
    customSpecies:
      values.species === 'other'
        ? validateRequired(values.customSpecies, SPECIES_MAX, 'Укажите вид')
        : null,
    breed: validateRequired(
      values.breed,
      BREED_MAX,
      'Укажите породу (или «метис»)',
    ),
    approxAddress: validateRequired(
      values.approxAddress,
      APPROX_ADDRESS_MAX,
      'Укажите район',
    ),
  };
}

export function hasPetFormErrors(errors: PetFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** The species to send: the chosen one, or the typed one for "other". */
function speciesValue(values: PetFormValues): string {
  return values.species === 'other'
    ? values.customSpecies.trim()
    : values.species ?? '';
}

/** POST /pets body of a valid form. */
export function buildPetCreateRequest(values: PetFormValues): PetCreateRequest {
  return {
    name: values.name.trim(),
    species: speciesValue(values),
    breed: values.breed.trim(),
    birth_date: values.birthDate,
    approx_address: values.approxAddress.trim(),
  };
}

/**
 * PATCH /pets/{id} body with only what changed (empty — nothing to save).
 * The species goes along with a new breed: otherwise the backend may derive
 * another species from the breed and override the owner's choice. The backend
 * can't clear a birth date (null means "unchanged"), so it is only ever set.
 */
export function buildPetUpdateRequest(
  pet: Pet,
  values: PetFormValues,
): PetUpdateRequest {
  const next = buildPetCreateRequest(values);
  const body: PetUpdateRequest = {};
  if (next.name !== pet.name) {
    body.name = next.name;
  }
  if (next.breed !== pet.breed) {
    body.breed = next.breed;
  }
  // The backend stores the species in lower case.
  const species = next.species ?? '';
  if (species.toLowerCase() !== pet.species || body.breed !== undefined) {
    body.species = species;
  }
  if (next.birth_date && next.birth_date !== pet.birth_date) {
    body.birth_date = next.birth_date;
  }
  if (next.approx_address !== pet.approx_address) {
    body.approx_address = next.approx_address;
  }
  return body;
}

/** Message for a failed POST /pets or PATCH /pets/{id}. */
export function describePetSaveError(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    const text = error.body?.error ?? '';
    if (text.includes('birth_date')) {
      return 'Дата рождения не может быть в будущем';
    }
    if (text.includes('species')) {
      return 'Укажите вид питомца';
    }
  }
  return describeError(error, {
    403: 'Можно менять только своих питомцев',
    404: 'Питомец не найден',
  });
}

/**
 * Whether the owner may delete one of `petCount` pets: never the last one. The
 * profile is run on behalf of a pet, and an owner without pets is sent back to
 * pet onboarding (see authStore), so the last pet can only be edited.
 */
export function canDeletePet(petCount: number): boolean {
  return petCount > 1;
}
