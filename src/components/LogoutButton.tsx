import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { useAuthStore } from '../store/authStore';
import { colors } from './form/theme';

/**
 * Header button that asks for confirmation and logs out — the way out of pet
 * onboarding (in the app, «Выйти» is on the profile screen).
 */
export function LogoutButton() {
  const logout = useAuthStore(state => state.logout);

  const confirm = () => {
    Alert.alert('Выйти из аккаунта?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <Pressable
      onPress={confirm}
      accessibilityRole="button"
      accessibilityLabel="Выйти"
      hitSlop={8}
      style={styles.button}
    >
      <Text style={styles.text}>Выйти</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 8,
  },
  text: {
    color: colors.primary,
    fontSize: 16,
  },
});
