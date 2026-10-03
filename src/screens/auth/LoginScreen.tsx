import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TextInputInstance } from 'react-native';

import { FormField } from '../../components/form/FormField';
import { FormScreen } from '../../components/form/FormScreen';
import { PrimaryButton } from '../../components/form/PrimaryButton';
import { colors } from '../../components/form/theme';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { describeError } from '../../utils/errors';
import { validateEmail } from '../../utils/validation';

interface LoginErrors {
  email?: string | null;
  password?: string | null;
}

/** App entry point for signed-out users: email + password. */
export function LoginScreen({ navigation }: RootStackScreenProps<'Login'>) {
  const login = useAuthStore(state => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    const nextErrors: LoginErrors = {
      email: validateEmail(email),
      password: password ? null : 'Введите пароль',
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      // On success the navigator swaps this screen for the app.
      await login(email, password);
    } catch (error) {
      setFormError(describeError(error, { 401: 'Неверный email или пароль' }));
      setSubmitting(false);
    }
  };

  return (
    <FormScreen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.logo}>🐾</Text>
        <Text style={styles.title}>Tailverse</Text>
        <Text style={styles.subtitle}>Соцсеть для ваших питомцев</Text>
      </View>

      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
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
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <PrimaryButton title="Войти" onPress={submit} loading={submitting} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Ещё нет аккаунта?</Text>
        <PrimaryButton
          title="Зарегистрироваться"
          variant="secondary"
          onPress={() => navigation.navigate('Register')}
          disabled={submitting}
        />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  logo: {
    fontSize: 48,
  },
  title: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
  },
  formError: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
    color: colors.error,
    backgroundColor: colors.errorLight,
  },
  footer: {
    marginTop: 32,
    gap: 8,
  },
  footerText: {
    textAlign: 'center',
    color: colors.muted,
  },
});
