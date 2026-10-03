import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getAnnouncement,
  joinAnnouncement,
  leaveAnnouncement,
} from '../../api';
import { placeLabel } from '../../components/AnnouncementCard';
import { FormScreen } from '../../components/form/FormScreen';
import { PrimaryButton } from '../../components/form/PrimaryButton';
import { colors } from '../../components/form/theme';
import { useNow } from '../../hooks/useNow';
import type { RootStackScreenProps } from '../../navigation/types';
import {
  petNameOf,
  useAnnouncementsStore,
} from '../../store/announcementsStore';
import { useAuthStore } from '../../store/authStore';
import type { LoadStatus } from '../../store/walkSpotsStore';
import type { AnnouncementDetails, Id } from '../../types';
import {
  WALK_PHASE_LABELS,
  describeJoinError,
  walkEnd,
  walkPhase,
} from '../../utils/announcements';
import { formatClock, formatDateTime, formatDuration } from '../../utils/date';
import { describeError } from '../../utils/errors';

/** A walk: who leads it, where and when, who joined; the owner's pets join or leave. */
export function AnnouncementDetailsScreen({
  navigation,
  route,
}: RootStackScreenProps<'AnnouncementDetails'>) {
  const { id } = route.params;
  const myPets = useAuthStore(state => state.pets);
  const petNames = useAnnouncementsStore(state => state.petNames);
  const spots = useAnnouncementsStore(state => state.spots);
  const ensureNames = useAnnouncementsStore(state => state.ensureNames);
  const now = useNow(60_000);

  const [details, setDetails] = useState<AnnouncementDetails | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [pendingPetId, setPendingPetId] = useState<Id | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const loaded = await getAnnouncement(id);
      setDetails(loaded);
      setStatus('success');
      ensureNames([loaded]);
    } catch (loadError) {
      setError(describeError(loadError, { 404: 'Прогулка не найдена' }));
      setStatus('error');
    }
  }, [id, ensureNames]);

  useEffect(() => {
    load();
  }, [load]);

  if (status !== 'success' || !details) {
    return (
      <View style={styles.center}>
        {status === 'error' ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              onPress={() => {
                setStatus('loading');
                load();
              }}
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

  const phase = walkPhase(details, now);
  const canJoin = phase === 'upcoming' || phase === 'ongoing';
  const leaderName = petNameOf(details.pet_id, petNames, myPets) ?? 'Питомец';
  const start = new Date(details.starts_at);
  const myLeader = myPets.some(pet => pet.id === details.pet_id);
  // The leading pet can't also join its own walk.
  const joinablePets = myPets.filter(pet => pet.id !== details.pet_id);

  const openPet = (petId: Id) =>
    navigation.navigate('PetProfile', { id: petId });

  const toggle = async (petId: Id, joined: boolean) => {
    setPendingPetId(petId);
    setActionError(null);
    try {
      if (joined) {
        await leaveAnnouncement(details.id, petId);
      } else {
        await joinAnnouncement(details.id, petId);
      }
    } catch (toggleError) {
      setActionError(
        joined
          ? describeError(toggleError, { 404: 'Питомец уже не участвует' })
          : describeJoinError(toggleError),
      );
    }
    await load();
    setPendingPetId(null);
  };

  return (
    <FormScreen>
      <View style={styles.titleRow}>
        <Pressable
          onPress={() => openPet(details.pet_id)}
          accessibilityRole="button"
          accessibilityLabel={`Профиль питомца ${leaderName}`}
          hitSlop={4}
          style={styles.titleLink}
        >
          <Text style={styles.title}>🐾 {leaderName}</Text>
        </Pressable>
        <Text style={styles.badge}>{WALK_PHASE_LABELS[phase]}</Text>
      </View>
      {myLeader && <Text style={styles.mine}>Ваша прогулка</Text>}

      <View style={styles.facts}>
        <Text style={styles.fact}>
          {details.spot_id ? '📍' : '📌'} {placeLabel(details, spots)}
          {details.custom_point
            ? ` (${details.custom_point.lat.toFixed(
                5,
              )}, ${details.custom_point.lng.toFixed(5)})`
            : ''}
        </Text>
        <Text style={styles.fact}>
          🕒 {formatDateTime(start, now)}–{formatClock(walkEnd(details))} ·{' '}
          {formatDuration(details.duration_min)}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        Идут вместе: {details.participants.length}
      </Text>
      {details.participants.length === 0 ? (
        <Text style={styles.muted}>Пока никто не присоединился.</Text>
      ) : (
        details.participants.map(participant => (
          <Pressable
            key={participant.pet_id}
            onPress={() => openPet(participant.pet_id)}
            accessibilityRole="button"
            accessibilityLabel={`Профиль питомца ${participant.pet_name}`}
            style={styles.participant}
          >
            <Text style={styles.participantName}>
              {participant.pet_name}
              {myPets.some(pet => pet.id === participant.pet_id) && (
                <Text style={styles.mineInline}> · ваш питомец</Text>
              )}
            </Text>
            {participant.owner_nickname ? (
              <Text style={styles.muted}>{participant.owner_nickname}</Text>
            ) : null}
          </Pressable>
        ))
      )}

      {joinablePets.length > 0 && (
        <View style={styles.actions}>
          <Text style={styles.sectionTitle}>Пойти вместе</Text>
          {joinablePets.map(pet => {
            const joined = details.participants.some(
              participant => participant.pet_id === pet.id,
            );
            return (
              <View key={pet.id} style={styles.petRow}>
                <Text style={styles.participantName}>{pet.name}</Text>
                {joined ? (
                  <PrimaryButton
                    title="Не пойду"
                    accessibilityLabel={`Не пойду: ${pet.name}`}
                    variant="secondary"
                    loading={pendingPetId === pet.id}
                    disabled={pendingPetId !== null}
                    onPress={() => toggle(pet.id, true)}
                    style={styles.petButton}
                  />
                ) : (
                  <PrimaryButton
                    title="Пойду"
                    accessibilityLabel={`Пойду с ${pet.name}`}
                    loading={pendingPetId === pet.id}
                    disabled={pendingPetId !== null || !canJoin}
                    onPress={() => toggle(pet.id, false)}
                    style={styles.petButton}
                  />
                )}
              </View>
            );
          })}
          {!canJoin && (
            <Text style={styles.muted}>
              К этой прогулке уже нельзя присоединиться.
            </Text>
          )}
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleLink: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  badge: {
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  mine: {
    marginTop: 2,
    color: colors.primary,
  },
  facts: {
    marginTop: 12,
    marginBottom: 20,
    gap: 6,
  },
  fact: {
    fontSize: 16,
    color: colors.text,
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  participant: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  participantName: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  mineInline: {
    color: colors.primary,
  },
  actions: {
    marginTop: 24,
    gap: 4,
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  petButton: {
    minHeight: 40,
    minWidth: 110,
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
