import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../../components/form/PrimaryButton';
import { colors } from '../../components/form/theme';
import { useAuthStore } from '../../store/authStore';

/** Shown while the saved session is being restored, with a retry if that fails. */
export function SplashScreen() {
  const restoreError = useAuthStore(state => state.restoreError);
  const restoreSession = useAuthStore(state => state.restoreSession);
  const logout = useAuthStore(state => state.logout);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🐾</Text>
      {restoreError ? (
        <>
          <Text style={styles.error}>
            Не удалось восстановить сессию: {restoreError}
          </Text>
          <PrimaryButton
            title="Повторить"
            onPress={restoreSession}
            style={styles.button}
          />
          <PrimaryButton
            title="Выйти"
            variant="secondary"
            onPress={logout}
            style={styles.button}
          />
        </>
      ) : (
        <ActivityIndicator size="large" color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  logo: {
    fontSize: 48,
    marginBottom: 24,
  },
  error: {
    marginBottom: 16,
    textAlign: 'center',
    color: colors.error,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
});
