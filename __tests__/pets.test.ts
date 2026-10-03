import { ApiError } from '../src/api/client';
import type { Pet } from '../src/types';
import {
  EMPTY_PET_FORM,
  buildPetCreateRequest,
  buildPetUpdateRequest,
  canDeletePet,
  describePetSaveError,
  hasPetFormErrors,
  petAge,
  petSummary,
  petToFormValues,
  validatePetForm,
} from '../src/utils/pets';

const pet: Pet = {
  id: 'p1',
  owner_id: 'o1',
  name: 'Бублик',
  breed: 'корги',
  species: 'dog',
  birth_date: '2022-05-01',
  age: 4,
  approx_address: 'Хамовники',
  created_at: '2026-10-03T10:00:00Z',
};

describe('pet form values', () => {
  test('known species become a choice, others free text', () => {
    expect(petToFormValues(pet)).toEqual({
      name: 'Бублик',
      species: 'dog',
      customSpecies: '',
      breed: 'корги',
      birthDate: '2022-05-01',
      approxAddress: 'Хамовники',
    });
    expect(petToFormValues({ ...pet, species: 'хорёк' })).toMatchObject({
      species: 'other',
      customSpecies: 'хорёк',
    });
  });

  test('validation matches the create rules', () => {
    const errors = validatePetForm({ ...EMPTY_PET_FORM, species: 'other' });
    expect(errors).toEqual({
      name: 'Введите кличку',
      species: null,
      customSpecies: 'Укажите вид',
      breed: 'Укажите породу (или «метис»)',
      approxAddress: 'Укажите район',
    });
    expect(hasPetFormErrors(errors)).toBe(true);
    expect(hasPetFormErrors(validatePetForm(petToFormValues(pet)))).toBe(false);
  });

  test('create request trims and resolves the species', () => {
    expect(
      buildPetCreateRequest({
        ...petToFormValues(pet),
        name: ' Бублик ',
        species: 'other',
        customSpecies: ' Хорёк ',
      }),
    ).toEqual({
      name: 'Бублик',
      species: 'Хорёк',
      breed: 'корги',
      birth_date: '2022-05-01',
      approx_address: 'Хамовники',
    });
  });
});

describe('buildPetUpdateRequest', () => {
  test('nothing changed — empty body', () => {
    expect(buildPetUpdateRequest(pet, petToFormValues(pet))).toEqual({});
    // The backend stores species in lower case: "Хорёк" vs "хорёк" is no change.
    const ferret = { ...pet, species: 'хорёк' };
    expect(
      buildPetUpdateRequest(ferret, {
        ...petToFormValues(ferret),
        customSpecies: 'Хорёк',
      }),
    ).toEqual({});
  });

  test('sends only the changed fields', () => {
    expect(
      buildPetUpdateRequest(pet, {
        ...petToFormValues(pet),
        name: 'Бубочка ',
        approxAddress: 'Центр',
        birthDate: '2021-01-02',
      }),
    ).toEqual({
      name: 'Бубочка',
      approx_address: 'Центр',
      birth_date: '2021-01-02',
    });
  });

  test('a new breed goes with the species, so the backend keeps the choice', () => {
    expect(
      buildPetUpdateRequest(pet, {
        ...petToFormValues(pet),
        breed: 'мейн-кун',
      }),
    ).toEqual({ breed: 'мейн-кун', species: 'dog' });
  });

  test('a removed birth date is sent as "" (null would leave it unchanged)', () => {
    expect(
      buildPetUpdateRequest(pet, { ...petToFormValues(pet), birthDate: null }),
    ).toEqual({ birth_date: '' });
    // No date before and none now: nothing to send.
    const noDate = { ...pet, birth_date: null };
    expect(buildPetUpdateRequest(noDate, petToFormValues(noDate))).toEqual({});
  });
});

test('age and summary come from the birth date', () => {
  const now = new Date(2026, 9, 3);
  expect(petAge(pet, now)).toBe(4);
  expect(petAge({ birth_date: null, age: null }, now)).toBeNull();
  expect(petSummary(pet, now)).toBe('Собака · корги · 4 года');
  expect(petSummary({ ...pet, species: 'хорёк', birth_date: null }, now)).toBe(
    'Хорёк · корги',
  );
});

test('the last pet cannot be deleted', () => {
  expect(canDeletePet(1)).toBe(false);
  expect(canDeletePet(2)).toBe(true);
});

test('save errors are explained', () => {
  expect(
    describePetSaveError(
      new ApiError(400, {
        msg: 'UpdatePet',
        error: 'birth_date is in the future: invalid argument',
      }),
    ),
  ).toBe('Дата рождения не может быть в будущем');
  expect(describePetSaveError(new ApiError(403, null))).toBe(
    'Можно менять только своих питомцев',
  );
});
