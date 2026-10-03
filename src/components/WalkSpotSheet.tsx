import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useNow } from '../hooks/useNow';
import { useAuthStore } from '../store/authStore';
import {
  activeCheckIn,
  useWalkSpotsStore,
  type LoadStatus,
} from '../store/walkSpotsStore';
import type { WalkSpotDetails } from '../types';
import { formatSince } from '../utils/date';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton } from './form/PrimaryButton';
import { colors } from './form/theme';

interface WalkSpotSheetProps {
  spot: WalkSpotDetails | null;
  status: LoadStatus;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  /** Opens the feed filtered by this spot; the link is hidden without it. */
  onShowPosts?: (spot: WalkSpotDetails) => void;
}

/**
 * Bottom sheet of the selected walk spot: who is there now (pet, owner, since
 * when), check-in/out for the signed-in owner's pets and a link to its posts.
 */
export function WalkSpotSheet({
  spot,
  status,
  error,
  onClose,
  onRetry,
  onShowPosts,
}: WalkSpotSheetProps) {
  const now = useNow(60_000);

  const header =
    status === 'success' && spot ? (
      <View>
        <Text style={styles.name}>{spot.name}</Text>
        {spot.tags.length > 0 && (
          <View style={styles.tags}>
            {spot.tags.map(tag => (
              <Text key={tag} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>
        )}
        {onShowPosts && (
          <Pressable
            onPress={() => onShowPosts(spot)}
            accessibilityRole="button"
            accessibilityLabel="Посты об этом месте"
            hitSlop={8}
            style={styles.postsLink}
          >
            <Text style={styles.link}>📝 Посты об этом месте</Text>
          </Pressable>
        )}
      </View>
    ) : null;

  return (
    <BottomSheet header={header} onClose={onClose}>
      {status === 'loading' && <ActivityIndicator style={styles.loader} />}

      {status === 'error' && (
        <View>
          <Text style={styles.error}>Не удалось загрузить место: {error}</Text>
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Text style={styles.link}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {status === 'success' && spot && (
        <>
          <PresentList spot={spot} now={now} />
          <CheckInSection spot={spot} now={now} />
        </>
      )}
    </BottomSheet>
  );
}

function PresentList({ spot, now }: { spot: WalkSpotDetails; now: Date }) {
  const myPetIds = useAuthStore(state => state.pets).map(pet => pet.id);

  return (
    <View>
      <Text style={styles.sectionTitle}>
        Сейчас здесь: {spot.present.length}
      </Text>
      {spot.present.length === 0 ? (
        <Text style={styles.muted}>
          Пока никого нет. Отметьтесь, когда придёте, — другие увидят, что здесь
          гуляют.
        </Text>
      ) : (
        spot.present.map(pet => (
          <View key={pet.pet_id} style={styles.presentRow}>
            <Text style={styles.presentIcon}>🐾</Text>
            <View style={styles.presentText}>
              <Text style={styles.petName}>
                {pet.pet_name}
                {myPetIds.includes(pet.pet_id) && (
                  <Text style={styles.mine}> · ваш питомец</Text>
                )}
              </Text>
              <Text style={styles.muted}>
                {pet.owner_nickname} · {formatSince(pet.checked_in_at, now)}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function CheckInSection({ spot, now }: { spot: WalkSpotDetails; now: Date }) {
  const pets = useAuthStore(state => state.pets);
  const myCheckIns = useWalkSpotsStore(state => state.myCheckIns);
  const pending = useWalkSpotsStore(state => state.presencePending);
  const presenceError = useWalkSpotsStore(state => state.presenceError);
  const checkIn = useWalkSpotsStore(state => state.checkIn);
  const checkOut = useWalkSpotsStore(state => state.checkOut);

  return (
    <View style={styles.checkIn}>
      <Text style={styles.sectionTitle}>Я здесь с…</Text>

      {pets.length === 0 ? (
        <Text style={styles.muted}>
          Добавьте питомца, чтобы отмечаться на местах выгула.
        </Text>
      ) : (
        pets.map(pet => {
          const here = spot.present.some(entry => entry.pet_id === pet.id);
          const elsewhere = activeCheckIn(myCheckIns, pet.id, now);
          const busy = pending?.petId === pet.id;
          return (
            <View key={pet.id} style={styles.petRow}>
              <View style={styles.presentText}>
                <Text style={styles.petName}>{pet.name}</Text>
                {here ? (
                  <Text style={styles.hereNote}>Вы отметились здесь</Text>
                ) : elsewhere && elsewhere.spot_id !== spot.id ? (
                  <Text style={styles.muted}>
                    Отметка на другом месте — перенесётся сюда
                  </Text>
                ) : null}
              </View>
              {here ? (
                <PrimaryButton
                  title="Уйти"
                  accessibilityLabel={`Уйти: ${pet.name}`}
                  variant="secondary"
                  loading={busy}
                  disabled={pending !== null}
                  onPress={() => checkOut(spot.id, pet.id)}
                  style={styles.petButton}
                />
              ) : (
                <PrimaryButton
                  title="Я здесь"
                  accessibilityLabel={`Я здесь с ${pet.name}`}
                  loading={busy}
                  disabled={pending !== null}
                  onPress={() => checkIn(spot.id, pet.id)}
                  style={styles.petButton}
                />
              )}
            </View>
          );
        })
      )}

      {presenceError ? <Text style={styles.error}>{presenceError}</Text> : null}

      {pets.length > 0 && (
        <Text style={styles.note}>
          Отметку видят все пользователи. Она исчезнет сама через 2 часа или
          когда вы нажмёте «Уйти».
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginRight: 28,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#eeeeee',
    color: '#424242',
  },
  sectionTitle: {
    marginTop: 12,
    marginBottom: 6,
    fontWeight: '600',
    color: colors.text,
  },
  presentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  presentIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  presentText: {
    flex: 1,
  },
  petName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  mine: {
    fontWeight: '400',
    color: colors.primary,
  },
  muted: {
    color: colors.muted,
  },
  checkIn: {
    marginTop: 8,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  hereNote: {
    color: '#2e7d32',
  },
  petButton: {
    minHeight: 40,
    minWidth: 110,
  },
  note: {
    marginTop: 10,
    fontSize: 12,
    color: colors.muted,
  },
  error: {
    marginTop: 8,
    color: colors.error,
    marginRight: 24,
  },
  link: {
    marginTop: 8,
    color: colors.primary,
    fontWeight: '600',
  },
  postsLink: {
    alignSelf: 'flex-start',
  },
});
