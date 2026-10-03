import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OwnerAvatar } from '../../components/OwnerAvatar';
import { PetListItem } from '../../components/PetListItem';
import { PrimaryButton } from '../../components/form/PrimaryButton';
import { colors } from '../../components/form/theme';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { describeError } from '../../utils/errors';
import { formatMemberSince, genderLabel } from '../../utils/profile';

const PUBLIC = 'видно всем';
const PRIVATE = 'видно только вам';

interface FieldRowProps {
  label: string;
  value: string;
  /** Who sees the field: shown under the value. */
  audience: string;
  last?: boolean;
}

function FieldRow({ label, value, audience, last = false }: FieldRowProps) {
  return (
    <View
      accessible
      style={[styles.field, last && styles.fieldLast]}
      accessibilityLabel={`${label}: ${value}, ${audience}`}
    >
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValue}>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        <Text
          style={[
            styles.audience,
            audience === PUBLIC ? styles.public : styles.private,
          ]}
        >
          {audience === PUBLIC ? '👁 ' : '🔒 '}
          {audience}
        </Text>
      </View>
    </View>
  );
}

/**
 * The signed-in owner's profile: photo, nickname, gender, email and who sees each
 * of them; their pets (tap — the pet's profile), adding a pet and logging out.
 */
export function ProfileScreen({ navigation }: RootStackScreenProps<'Profile'>) {
  const owner = useAuthStore(state => state.owner);
  const pets = useAuthStore(state => state.pets);
  const reloadProfile = useAuthStore(state => state.reloadProfile);
  const logout = useAuthStore(state => state.logout);

  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      await reloadProfile();
    } catch (error) {
      setLoadError(describeError(error));
    }
  }, [reloadProfile]);

  // The profile may be missing (e.g. it failed to load right after registering).
  useEffect(() => {
    if (!useAuthStore.getState().owner) {
      reload();
    }
  }, [reload]);

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const confirmLogout = () => {
    Alert.alert('Выйти из аккаунта?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        {owner ? (
          <>
            <View style={styles.top}>
              <OwnerAvatar
                url={owner.avatar_url}
                nickname={owner.nickname}
                size={72}
              />
              <View style={styles.topText}>
                <Text style={styles.nickname}>{owner.nickname}</Text>
                <Text style={styles.muted}>
                  {formatMemberSince(owner.created_at) ?? ''}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <FieldRow
                label="Никнейм"
                value={owner.nickname}
                audience={PUBLIC}
              />
              <FieldRow
                label="Пол"
                value={genderLabel(owner.gender)}
                audience={owner.visibility.gender ? PUBLIC : PRIVATE}
              />
              <FieldRow
                label="Фото"
                value={owner.avatar_url ? 'Есть' : 'Нет'}
                audience={owner.visibility.avatar_url ? PUBLIC : PRIVATE}
              />
              <FieldRow
                label="Email"
                value={owner.email}
                audience={PRIVATE}
                last
              />
            </View>
            <PrimaryButton
              title="Редактировать профиль"
              variant="secondary"
              onPress={() => navigation.navigate('EditProfile')}
              style={styles.button}
            />
          </>
        ) : loadError ? (
          <View style={styles.notice}>
            <Text style={styles.error}>
              Не удалось загрузить профиль: {loadError}
            </Text>
            <Pressable
              onPress={reload}
              accessibilityRole="button"
              accessibilityLabel="Повторить"
              hitSlop={8}
            >
              <Text style={styles.link}>Повторить</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator style={styles.notice} />
        )}

        <Text style={styles.section}>Мои питомцы · {pets.length}</Text>
        <Text style={[styles.muted, styles.sectionHint]}>
          Профиль в Tailverse ведётся от имени питомцев: другие видят их клички,
          породу, возраст и примерный район.
        </Text>
        {pets.map(pet => (
          <PetListItem
            key={pet.id}
            pet={pet}
            onPress={({ id }) => navigation.navigate('PetProfile', { id })}
          />
        ))}
        <PrimaryButton
          title="Добавить питомца"
          variant="secondary"
          onPress={() => navigation.navigate('AddPet')}
        />

        <Pressable
          onPress={confirmLogout}
          accessibilityRole="button"
          accessibilityLabel="Выйти"
          hitSlop={8}
          style={styles.logout}
        >
          <Text style={styles.logoutText}>Выйти из аккаунта</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  topText: {
    flex: 1,
    gap: 2,
  },
  nickname: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  fieldLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    width: 80,
    color: colors.muted,
  },
  fieldValue: {
    flex: 1,
    gap: 2,
  },
  value: {
    fontSize: 16,
    color: colors.text,
  },
  audience: {
    fontSize: 12,
  },
  public: {
    color: '#2e7d32',
  },
  private: {
    color: colors.muted,
  },
  button: {
    marginTop: 12,
  },
  section: {
    marginTop: 28,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  sectionHint: {
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 19,
  },
  muted: {
    color: colors.muted,
  },
  notice: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  error: {
    color: colors.error,
    textAlign: 'center',
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
  logout: {
    alignSelf: 'center',
    marginTop: 32,
    padding: 8,
  },
  logoutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
});
