import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import type { TextInputInstance } from 'react-native';

import { AvatarPicker } from '../../components/form/AvatarPicker';
import { ChoiceChips, type Choice } from '../../components/form/ChoiceChips';
import { FormField } from '../../components/form/FormField';
import { FormScreen } from '../../components/form/FormScreen';
import { PrimaryButton } from '../../components/form/PrimaryButton';
import { SwitchRow } from '../../components/form/SwitchRow';
import { colors } from '../../components/form/theme';
import { ApiError } from '../../api';
import { useAuthStore } from '../../store/authStore';
import type { Gender, UploadFile } from '../../types';
import { describeError } from '../../utils/errors';
import {
  NICKNAME_MAX,
  PASSWORD_MIN,
  validateEmail,
  validatePassword,
  validateRequired,
} from '../../utils/validation';

type GenderChoice = Gender | 'none';

const GENDER_OPTIONS: Choice<GenderChoice>[] = [
  { value: 'none', label: 'Не указан' },
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
  { value: 'other', label: 'Другой' },
];

interface RegisterErrors {
  email?: string | null;
  password?: string | null;
  nickname?: string | null;
}

/** Creates the owner account; pets are added on the next screens. */
export function RegisterScreen() {
  const register = useAuthStore(state => state.register);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<GenderChoice>('none');
  const [avatar, setAvatar] = useState<UploadFile | null>(null);
  // Backend defaults: gender hidden, avatar shown.
  const [showGender, setShowGender] = useState(false);
  const [showAvatar, setShowAvatar] = useState(true);

  const [errors, setErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const nicknameRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    const nextErrors: RegisterErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
      nickname: validateRequired(nickname, NICKNAME_MAX, 'Введите никнейм'),
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password || nextErrors.nickname) {
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const { avatarUploaded } = await register({
        email,
        password,
        nickname,
        gender: gender === 'none' ? null : gender,
        visibility: { gender: showGender, avatar_url: showAvatar },
        avatar,
      });
      if (!avatarUploaded) {
        Alert.alert(
          'Аккаунт создан',
          'Но фото профиля загрузить не удалось. Его можно будет добавить позже в профиле.',
        );
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ email: 'Этот email уже зарегистрирован' });
      } else {
        setFormError(describeError(error));
      }
      setSubmitting(false);
    }
  };

  return (
    <FormScreen>
      <Text style={styles.section}>Аккаунт</Text>
      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        hint="Используется для входа, другим не виден"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <FormField
        ref={passwordRef}
        label="Пароль"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        hint={`Не короче ${PASSWORD_MIN} символов`}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => nicknameRef.current?.focus()}
        submitBehavior="submit"
      />

      <Text style={styles.section}>Профиль владельца</Text>
      <FormField
        ref={nicknameRef}
        label="Никнейм"
        value={nickname}
        onChangeText={setNickname}
        error={errors.nickname}
        hint="Виден всем пользователям"
        maxLength={NICKNAME_MAX}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
      />
      <AvatarPicker value={avatar} onChange={setAvatar} />
      <ChoiceChips
        label="Пол"
        options={GENDER_OPTIONS}
        value={gender}
        onChange={setGender}
      />

      <Text style={styles.section}>Что видят другие</Text>
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
        title="Создать аккаунт"
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
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
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
