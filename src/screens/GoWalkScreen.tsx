import { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AnnouncementCard, placeLabel } from '../components/AnnouncementCard';
import { PrimaryButton } from '../components/form/PrimaryButton';
import { colors } from '../components/form/theme';
import { useNow } from '../hooks/useNow';
import type { RootTabScreenProps } from '../navigation/types';
import {
  ANNOUNCEMENTS_RADIUS_M,
  petNameOf,
  useAnnouncementsStore,
} from '../store/announcementsStore';
import { useAuthStore } from '../store/authStore';
import { useLocationStore } from '../store/locationStore';
import type { Announcement } from '../types';
import { DEFAULT_REGION, formatDistance, regionCenter } from '../utils/geo';

const DEFAULT_CENTER = regionCenter(DEFAULT_REGION);

/**
 * The "Иду гулять" tab: walks announced around the user (or the place picked on
 * the map, or the city centre), with the entry to announcing one.
 */
export function GoWalkScreen({ navigation }: RootTabScreenProps<'GoWalk'>) {
  const announcements = useAnnouncementsStore(state => state.announcements);
  const status = useAnnouncementsStore(state => state.status);
  const error = useAnnouncementsStore(state => state.error);
  const refreshing = useAnnouncementsStore(state => state.refreshing);
  const petNames = useAnnouncementsStore(state => state.petNames);
  const spots = useAnnouncementsStore(state => state.spots);
  const fetchAnnouncements = useAnnouncementsStore(
    state => state.fetchAnnouncements,
  );
  const refresh = useAnnouncementsStore(state => state.refresh);
  const myPets = useAuthStore(state => state.pets);

  const manualPoint = useLocationStore(state => state.manualPoint);
  const userPosition = useLocationStore(state => state.userPosition);
  const checkPermission = useLocationStore(state => state.checkPermission);

  const now = useNow(60_000);
  const center = manualPoint ?? userPosition ?? DEFAULT_CENTER;
  const centerSource = manualPoint
    ? 'от выбранного на карте места'
    : userPosition
    ? 'от вас'
    : 'от центра города';

  // Locates the user when access was granted before (never prompts).
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  useEffect(() => {
    fetchAnnouncements({ lat: center.lat, lng: center.lng });
  }, [center.lat, center.lng, fetchAnnouncements]);

  const myPetIds = useMemo(() => new Set(myPets.map(pet => pet.id)), [myPets]);

  const openDetails = useCallback(
    (announcement: Announcement) =>
      navigation.navigate('AnnouncementDetails', { id: announcement.id }),
    [navigation],
  );

  const header = (
    <View style={styles.header}>
      <PrimaryButton
        title="Создать объявление"
        onPress={() => navigation.navigate('CreateAnnouncement')}
      />
      <Text style={styles.caption}>
        Прогулки в радиусе {formatDistance(ANNOUNCEMENTS_RADIUS_M)}{' '}
        {centerSource}
      </Text>
      {status === 'error' && announcements.length > 0 && (
        <Text style={styles.error}>Не удалось обновить: {error}</Text>
      )}
    </View>
  );

  let empty;
  if (status === 'error') {
    empty = (
      <View style={styles.empty}>
        <Text style={styles.error}>Не удалось загрузить прогулки: {error}</Text>
        <Pressable
          onPress={() => fetchAnnouncements(center)}
          accessibilityRole="button"
          accessibilityLabel="Повторить"
          hitSlop={8}
        >
          <Text style={styles.link}>Повторить</Text>
        </Pressable>
      </View>
    );
  } else if (status === 'success') {
    empty = (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Рядом пока никто не гуляет</Text>
        <Text style={styles.muted}>
          Объявите прогулку — питомцы поблизости увидят, где и когда вас найти.
        </Text>
      </View>
    );
  } else {
    empty = <ActivityIndicator style={styles.loader} />;
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={announcements}
      keyExtractor={item => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item }) => (
        <AnnouncementCard
          announcement={item}
          petName={petNameOf(item.pet_id, petNames, myPets)}
          place={placeLabel(item, spots)}
          mine={myPetIds.has(item.pet_id)}
          now={now}
          onPress={openDetails}
        />
      )}
      ItemSeparatorComponent={Separator}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 12,
    gap: 10,
  },
  caption: {
    color: colors.muted,
    textAlign: 'center',
  },
  separator: {
    height: 10,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
  },
  error: {
    color: colors.error,
    textAlign: 'center',
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
  loader: {
    paddingVertical: 32,
  },
});
