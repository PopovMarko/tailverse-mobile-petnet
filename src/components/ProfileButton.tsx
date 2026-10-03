import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Pressable, StyleSheet } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { OwnerAvatar } from './OwnerAvatar';

/** Header button of the main tabs: the owner's avatar (or initial), opens the profile. */
export function ProfileButton() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const owner = useAuthStore(state => state.owner);

  return (
    <Pressable
      onPress={() => navigation.navigate('Profile')}
      accessibilityRole="button"
      accessibilityLabel="Мой профиль"
      hitSlop={8}
      style={styles.button}
    >
      <OwnerAvatar
        url={owner?.avatar_url ?? null}
        nickname={owner?.nickname ?? ''}
        size={30}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 8,
  },
});
