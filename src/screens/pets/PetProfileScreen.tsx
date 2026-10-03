import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getOwner, getPet } from '../../api';
import { OwnerAvatar } from '../../components/OwnerAvatar';
import { FormScreen } from '../../components/form/FormScreen';
import { PrimaryButton } from '../../components/form/PrimaryButton';
import { colors } from '../../components/form/theme';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import type { LoadStatus } from '../../store/walkSpotsStore';
import type { Pet, PublicOwner } from '../../types';
import { formatAge, formatDate } from '../../utils/date';
import { describeError } from '../../utils/errors';
import { canDeletePet, petAge, speciesLabel } from '../../utils/pets';
import { formatMemberSince, genderLabel } from '../../utils/profile';

/**
 * A pet's profile. The owner's own pet comes from the session (edit, delete);
 * anyone else's is loaded (GET /pets/{id}) and shown read-only with its owner's
 * public card (GET /owners/{id}: only what the owner chose to show).
 */
export function PetProfileScreen({
  navigation,
  route,
}: RootStackScreenProps<'PetProfile'>) {
  const { id } = route.params;
  const myPet = useAuthStore(state => state.pets.find(pet => pet.id === id));
  // An own pet stays own: once it is deleted the screen is just leaving.
  const [mine] = useState(() =>
    useAuthStore.getState().pets.some(pet => pet.id === id),
  );

  if (!mine) {
    return <PublicPetProfile id={id} />;
  }
  if (!myPet) {
    return null;
  }
  return (
    <MyPetProfile
      pet={myPet}
      onEdit={() => navigation.navigate('EditPet', { id })}
      onDeleted={() => navigation.goBack()}
    />
  );
}

function PetFacts({ pet }: { pet: Pet }) {
  const age = petAge(pet);
  return (
    <View style={styles.card}>
      <Fact label="Вид" value={speciesLabel(pet.species) || '—'} />
      <Fact label="Порода" value={pet.breed || '—'} />
      <Fact
        label="Возраст"
        value={
          pet.birth_date && age !== null
            ? `${formatAge(age)} (${formatDate(pet.birth_date)})`
            : 'Не указан'
        }
      />
      <Fact label="Район" value={pet.approx_address || '—'} last />
    </View>
  );
}

function Fact({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.fact, last && styles.factLast]}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function MyPetProfile({
  pet,
  onEdit,
  onDeleted,
}: {
  pet: Pet;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const petCount = useAuthStore(state => state.pets.length);
  const deletePet = useAuthStore(state => state.deletePet);
  const [deleting, setDeleting] = useState(false);
  const deletable = canDeletePet(petCount);

  const confirmDelete = () => {
    Alert.alert(
      `Удалить ${pet.name}?`,
      'Вместе с профилем питомца удалятся его посты, прогулки и отметки на площадках. Это нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deletePet(pet.id);
              onDeleted();
            } catch (error) {
              setDeleting(false);
              Alert.alert(
                'Не удалось удалить питомца',
                describeError(error, {
                  403: 'Можно удалять только своих питомцев',
                }),
              );
            }
          },
        },
      ],
    );
  };

  return (
    <FormScreen>
      <Text style={styles.title}>🐾 {pet.name}</Text>
      <Text style={styles.mine}>Ваш питомец</Text>
      <PetFacts pet={pet} />
      <Text style={styles.note}>
        Профиль питомца видят все. Район — примерный, точный адрес не
        показывается.
      </Text>

      <PrimaryButton
        title="Редактировать"
        onPress={onEdit}
        style={styles.button}
      />
      <PrimaryButton
        title="Удалить питомца"
        variant="secondary"
        onPress={confirmDelete}
        loading={deleting}
        disabled={!deletable}
        style={styles.button}
      />
      {!deletable && (
        <Text style={styles.note}>
          Это ваш единственный питомец. Профиль в Tailverse ведётся от имени
          питомца, поэтому последнего удалить нельзя: его можно отредактировать
          или сначала добавить другого.
        </Text>
      )}
    </FormScreen>
  );
}

function PublicPetProfile({ id }: { id: string }) {
  const [pet, setPet] = useState<Pet | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<PublicOwner | null>(null);
  const [ownerStatus, setOwnerStatus] = useState<LoadStatus>('idle');

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const loaded = await getPet(id);
      setPet(loaded);
      setStatus('success');
      setOwnerStatus('loading');
      try {
        setOwner(await getOwner(loaded.owner_id));
        setOwnerStatus('success');
      } catch {
        setOwnerStatus('error');
      }
    } catch (loadError) {
      setError(describeError(loadError, { 404: 'Питомец не найден' }));
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (status !== 'success' || !pet) {
    return (
      <View style={styles.center}>
        {status === 'error' ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              onPress={load}
              accessibilityRole="button"
              accessibilityLabel="Повторить"
              hitSlop={8}
            >
              <Text style={styles.link}>Повторить</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  return (
    <FormScreen>
      <Text style={styles.title}>🐾 {pet.name}</Text>
      <PetFacts pet={pet} />

      <Text style={styles.section}>Владелец</Text>
      {ownerStatus === 'loading' && <ActivityIndicator />}
      {ownerStatus === 'error' && (
        <Text style={styles.muted}>Не удалось загрузить владельца.</Text>
      )}
      {owner && (
        <View style={styles.owner}>
          <OwnerAvatar
            url={owner.avatar_url}
            nickname={owner.nickname}
            size={52}
          />
          <View style={styles.ownerText}>
            <Text style={styles.ownerName}>{owner.nickname}</Text>
            {owner.gender && (
              <Text style={styles.muted}>Пол: {genderLabel(owner.gender)}</Text>
            )}
            <Text style={styles.muted}>
              {formatMemberSince(owner.created_at) ?? ''}
            </Text>
          </View>
        </View>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  mine: {
    marginTop: 2,
    color: colors.primary,
  },
  card: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
  },
  fact: {
    flexDirection: 'row',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  factLast: {
    borderBottomWidth: 0,
  },
  factLabel: {
    width: 80,
    color: colors.muted,
  },
  factValue: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  note: {
    marginTop: 10,
    color: colors.muted,
    lineHeight: 19,
  },
  button: {
    marginTop: 12,
  },
  section: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  ownerText: {
    flex: 1,
    gap: 2,
  },
  ownerName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  muted: {
    color: colors.muted,
  },
  error: {
    color: colors.error,
    textAlign: 'center',
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
