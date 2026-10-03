import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AvatarPicker } from '../../components/form/AvatarPicker';
import { ChoiceChips, type Choice } from '../../components/form/ChoiceChips';
import { FormField } from '../../components/form/FormField';
import { FormScreen } from '../../components/form/FormScreen';
import { PrimaryButton } from '../../components/form/PrimaryButton';
import { SwitchRow } from '../../components/form/SwitchRow';
import { colors } from '../../components/form/theme';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import type { Gender, Owner, UploadFile } from '../../types';
import {
  GENDER_LABELS,
  buildOwnerUpdateRequest,
  describeProfileSaveError,
} from '../../utils/profile';
import { NICKNAME_MAX, validateRequired } from '../../utils/validation';

type GenderChoice = Gender | 'none';

const GENDER_OPTIONS: Choice<GenderChoice>[] = [
  { value: 'none', label: 'Не указан' },
  { value: 'male', label: GENDER_LABELS.male },
  { value: 'female', label: GENDER_LABELS.female },
  { value: 'other', label: GENDER_LABELS.other },
];

/** Edits the signed-in owner's profile; opened from the profile screen. */
export function EditProfileScreen({
  navigation,
}: RootStackScreenProps<'EditProfile'>) {
  const owner = useAuthStore(state => state.owner);

  if (!owner) {
    return (
      <FormScreen>
        <Text style={styles.muted}>Профиль ещё не загружен.</Text>
      </FormScreen>
    );
  }
  return <EditProfileForm owner={owner} onDone={() => navigation.goBack()} />;
}

function EditProfileForm({
  owner,
  onDone,
}: {
  owner: Owner;
  onDone: () => void;
}) {
  const updateProfile = useAuthStore(state => state.updateProfile);

  const [nickname, setNickname] = useState(owner.nickname);
  const [gender, setGender] = useState<GenderChoice>(owner.gender ?? 'none');
  // A newly picked photo (uploaded on save), or the saved one removed.
  const [avatarFile, setAvatarFile] = useState<UploadFile | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [showGender, setShowGender] = useState(owner.visibility.gender);
  const [showAvatar, setShowAvatar] = useState(owner.visibility.avatar_url);

  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const error = validateRequired(nickname, NICKNAME_MAX, 'Введите никнейм');
    setNicknameError(error);
    if (error) {
      return;
    }

    const changes = buildOwnerUpdateRequest(owner, {
      nickname,
      gender: gender === 'none' ? null : gender,
      // A new photo's URL is only known after the upload (done by the store).
      avatarUrl: avatarRemoved && !avatarFile ? null : owner.avatar_url,
      visibility: { gender: showGender, avatar_url: showAvatar },
    });

    setFormError(null);
    setSubmitting(true);
    try {
      await updateProfile(changes, avatarFile);
      onDone();
    } catch (saveError) {
      setFormError(describeProfileSaveError(saveError));
      setSubmitting(false);
    }
  };

  return (
    <FormScreen>
      <AvatarPicker
        value={avatarFile}
        currentUrl={avatarRemoved ? null : owner.avatar_url}
        onChange={file => {
          setAvatarFile(file);
          setAvatarRemoved(file === null);
        }}
      />
      <FormField
        label="Никнейм"
        value={nickname}
        onChangeText={setNickname}
        error={nicknameError}
        hint="Виден всем пользователям"
        maxLength={NICKNAME_MAX}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
      />
      <ChoiceChips
        label="Пол"
        options={GENDER_OPTIONS}
        value={gender}
        onChange={setGender}
      />

      <Text style={styles.section}>Что видят другие</Text>
      <Text style={styles.note}>
        Никнейм и питомцы видны всем. Email не видит никто, кроме вас.
      </Text>
      <SwitchRow
        label="Показывать пол"
        description={gender === 'none' ? 'Пол не указан' : undefined}
        value={showGender}
        onValueChange={setShowGender}
      />
      <SwitchRow
        label="Показывать фото профиля"
        value={showAvatar}
        onValueChange={setShowAvatar}
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
  section: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  note: {
    marginBottom: 4,
    color: colors.muted,
    lineHeight: 19,
  },
  muted: {
    color: colors.muted,
  },
  formError: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
    color: colors.error,
    backgroundColor: colors.errorLight,
  },
  submit: {
    marginTop: 20,
  },
});
