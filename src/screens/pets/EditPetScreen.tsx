import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { PetFormFields } from '../../components/PetFormFields';
import { FormScreen } from '../../components/form/FormScreen';
import { PrimaryButton } from '../../components/form/PrimaryButton';
import { colors } from '../../components/form/theme';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import type { Pet } from '../../types';
import {
  buildPetUpdateRequest,
  describePetSaveError,
  hasPetFormErrors,
  petToFormValues,
  validatePetForm,
  type PetFormErrors,
  type PetFormValues,
} from '../../utils/pets';

/** Edits one of the owner's pets (PATCH /pets/{id} with the changed fields only). */
export function EditPetScreen({
  navigation,
  route,
}: RootStackScreenProps<'EditPet'>) {
  const pet = useAuthStore(state =>
    state.pets.find(item => item.id === route.params.id),
  );

  if (!pet) {
    return (
      <FormScreen>
        <Text style={styles.muted}>Питомец не найден.</Text>
      </FormScreen>
    );
  }
  return <EditPetForm pet={pet} onDone={() => navigation.goBack()} />;
}

function EditPetForm({ pet, onDone }: { pet: Pet; onDone: () => void }) {
  const updatePet = useAuthStore(state => state.updatePet);

  const [values, setValues] = useState<PetFormValues>(() =>
    petToFormValues(pet),
  );
  const [errors, setErrors] = useState<PetFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const nextErrors = validatePetForm(values);
    setErrors(nextErrors);
    if (hasPetFormErrors(nextErrors)) {
      return;
    }
    const changes = buildPetUpdateRequest(pet, values);
    if (Object.keys(changes).length === 0) {
      onDone();
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await updatePet(pet.id, changes);
      onDone();
    } catch (error) {
      setFormError(describePetSaveError(error));
      setSubmitting(false);
    }
  };

  return (
    <FormScreen>
      <PetFormFields
        values={values}
        errors={errors}
        onChange={changes => setValues(current => ({ ...current, ...changes }))}
        birthDateClearable={pet.birth_date === null}
      />

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <PrimaryButton
        title="Сохранить"
        onPress={submit}
        loading={submitting}
        style={styles.submit}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.muted,
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
