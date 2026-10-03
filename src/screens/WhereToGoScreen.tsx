import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ChoiceChips } from '../components/form/ChoiceChips';
import { PrimaryButton } from '../components/form/PrimaryButton';
import { colors } from '../components/form/theme';
import { useSpotSuggestions } from '../hooks/useSpotSuggestions';
import type { RootTabScreenProps } from '../navigation/types';
import { openAppSettings } from '../services/location';
import { useAuthStore } from '../store/authStore';
import { useLocationStore } from '../store/locationStore';
import type { Id } from '../types';
import { plural } from '../utils/date';
import { DEFAULT_REGION, formatDistance, regionCenter } from '../utils/geo';
import {
  CENTER_LABELS,
  SORT_LABELS,
  SUGGESTIONS_RADIUS_M,
  availableCenters,
  resolveCenterSource,
  sortSuggestions,
  suggestionToPlace,
  type CenterSource,
  type SpotSuggestion,
  type SuggestionSort,
} from '../utils/whereToGo';

const CITY_CENTER = regionCenter(DEFAULT_REGION);

const CENTER_CAPTIONS: Record<CenterSource, string> = {
  me: 'от вашего местоположения',
  manual: 'от места, выбранного на карте',
  city: 'от центра Кривого Рога',
};

const SORT_OPTIONS = (Object.keys(SORT_LABELS) as SuggestionSort[]).map(
  value => ({ value, label: SORT_LABELS[value] }),
);

/**
 * The «Куда пойти» tab: walk spots worth going to around the user (with location
 * access), the place picked on the map, or the city centre — with how far they
 * are, who is there now and the walks announced there. A spot opens on the map,
 * starts a walk announcement or shows its posts.
 */
export function WhereToGoScreen({
  navigation,
}: RootTabScreenProps<'WhereToGo'>) {
  const permission = useLocationStore(state => state.permission);
  const declined = useLocationStore(state => state.declined);
  const userPosition = useLocationStore(state => state.userPosition);
  const manualPoint = useLocationStore(state => state.manualPoint);
  const locating = useLocationStore(state => state.locating);
  const checkPermission = useLocationStore(state => state.checkPermission);
  const requestPermission = useLocationStore(state => state.requestPermission);
  const profileArea = useAuthStore(
    state => state.pets.find(pet => pet.approx_address)?.approx_address,
  );

  const [chosenCenter, setChosenCenter] = useState<CenterSource | null>(null);
  const [sort, setSort] = useState<SuggestionSort>('near');
  const [openId, setOpenId] = useState<Id | null>(null);

  // Locates the user when access was granted before (never prompts).
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  const candidates = { userPosition, manualPoint };
  const centers = availableCenters(candidates);
  const source = resolveCenterSource(chosenCenter, candidates);
  const center =
    (source === 'me'
      ? userPosition
      : source === 'manual'
      ? manualPoint
      : null) ?? CITY_CENTER;

  const { suggestions, status, error, refreshing, reload, refresh } =
    useSpotSuggestions(center.lat, center.lng);
  const sorted = useMemo(
    () => sortSuggestions(suggestions, sort),
    [suggestions, sort],
  );

  let locationText: string;
  if (permission === 'blocked') {
    locationText =
      'Доступ к геолокации выключен — его можно включить в Настройках.';
  } else if (declined) {
    locationText = 'Доступ к геолокации не дан.';
  } else {
    locationText =
      'С доступом к геолокации подборка строится от того места, где вы сейчас. Местоположение никому не показывается.';
  }

  const header = (
    <View style={styles.header}>
      {(permission === 'requestable' || permission === 'blocked') && (
        <View style={styles.locationCard}>
          <Text style={styles.locationTitle}>
            📍 Подобрать места рядом с вами?
          </Text>
          <Text style={styles.locationBody}>
            {locationText} Можно и без неё: удерживайте палец на карте, чтобы
            выбрать место.
          </Text>
          <View style={styles.locationActions}>
            {permission === 'requestable' ? (
              <PrimaryButton
                title="Разрешить"
                onPress={requestPermission}
                style={styles.locationButton}
              />
            ) : (
              <PrimaryButton
                title="Настройки"
                accessibilityLabel="Открыть настройки"
                onPress={openAppSettings}
                style={styles.locationButton}
              />
            )}
            <PrimaryButton
              title="Выбрать на карте"
              variant="secondary"
              onPress={() => navigation.navigate('Map')}
              style={styles.locationButton}
            />
          </View>
        </View>
      )}

      {centers.length > 1 && (
        <ChoiceChips
          label="Откуда искать"
          options={centers.map(value => ({
            value,
            label: CENTER_LABELS[value],
          }))}
          value={source}
          onChange={value => {
            setChosenCenter(value);
            setOpenId(null);
          }}
        />
      )}
      <Text style={styles.caption}>
        Места для прогулки в радиусе {formatDistance(SUGGESTIONS_RADIUS_M)}{' '}
        {CENTER_CAPTIONS[source]}
        {locating && source !== 'me' ? ' · определяем, где вы…' : ''}
      </Text>
      {source === 'city' && profileArea ? (
        <Text style={styles.caption}>
          Район из профиля («{profileArea}») пока не определяется на карте.
        </Text>
      ) : null}

      <ChoiceChips
        label="Сначала"
        options={SORT_OPTIONS}
        value={sort}
        onChange={setSort}
      />

      {status === 'error' && suggestions.length > 0 && (
        <Text style={styles.error}>Не удалось обновить: {error}</Text>
      )}
    </View>
  );

  let empty;
  if (status === 'error') {
    empty = (
      <View style={styles.empty}>
        <Text style={styles.error}>Не удалось загрузить места: {error}</Text>
        <Pressable
          onPress={reload}
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
        <Text style={styles.emptyTitle}>
          Поблизости пока нет мест для выгула
        </Text>
        <Text style={styles.muted}>
          Выберите другое место на карте — удерживайте палец там, где хотите
          погулять.
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
      data={sorted}
      keyExtractor={item => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item }) => (
        <SuggestionCard
          suggestion={item}
          open={item.id === openId}
          onPress={() => setOpenId(id => (id === item.id ? null : item.id))}
          onShowOnMap={() =>
            navigation.navigate('Map', {
              focusSpot: suggestionToPlace(item, false),
            })
          }
          onGoWalk={() =>
            navigation.navigate('CreateAnnouncement', {
              spot: suggestionToPlace(item, source === 'me'),
            })
          }
          onShowPosts={() =>
            navigation.navigate('Feed', {
              spot: suggestionToPlace(item, false),
            })
          }
        />
      )}
      ItemSeparatorComponent={Separator}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    />
  );
}

interface SuggestionCardProps {
  suggestion: SpotSuggestion;
  /** The actions are shown. */
  open: boolean;
  onPress: () => void;
  onShowOnMap: () => void;
  onGoWalk: () => void;
  onShowPosts: () => void;
}

function SuggestionCard({
  suggestion,
  open,
  onPress,
  onShowOnMap,
  onGoWalk,
  onShowPosts,
}: SuggestionCardProps) {
  const walks = suggestion.upcoming_walks ?? 0;
  return (
    <View style={[styles.card, open && styles.cardOpen]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={suggestion.name}
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.cardTop}>
          <Text style={styles.name} numberOfLines={2}>
            📍 {suggestion.name}
          </Text>
          <Text style={styles.distance}>
            {formatDistance(suggestion.distance_m)}
          </Text>
        </View>
        <Text
          style={[
            styles.line,
            suggestion.present_count > 0 && styles.lineActive,
          ]}
        >
          🐾 Сейчас гуляют: {suggestion.present_count}
        </Text>
        {walks > 0 && (
          <Text style={styles.line}>
            🗓 {walks} {plural(walks, ['прогулка', 'прогулки', 'прогулок'])} в
            ближайшие сутки
          </Text>
        )}
        {suggestion.tags.length > 0 && (
          <View style={styles.tags}>
            {suggestion.tags.map(tag => (
              <Text key={tag} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>
        )}
        {!open && <Text style={styles.hint}>Нажмите, чтобы выбрать</Text>}
      </Pressable>
      {open && (
        <View style={styles.actions}>
          <PrimaryButton
            title="Иду гулять сюда"
            accessibilityLabel={`Иду гулять сюда: ${suggestion.name}`}
            onPress={onGoWalk}
          />
          <View style={styles.actionsRow}>
            <PrimaryButton
              title="На карте"
              accessibilityLabel={`На карте: ${suggestion.name}`}
              variant="secondary"
              onPress={onShowOnMap}
              style={styles.action}
            />
            <PrimaryButton
              title="Посты о месте"
              accessibilityLabel={`Посты об этом месте: ${suggestion.name}`}
              variant="secondary"
              onPress={onShowPosts}
              style={styles.action}
            />
          </View>
        </View>
      )}
    </View>
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
    marginBottom: 4,
  },
  locationCard: {
    padding: 14,
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  locationBody: {
    marginTop: 6,
    color: colors.text,
    lineHeight: 20,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  locationButton: {
    flex: 1,
    minHeight: 44,
  },
  caption: {
    marginBottom: 12,
    color: colors.muted,
  },
  separator: {
    height: 10,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: colors.background,
  },
  cardOpen: {
    borderColor: colors.primary,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  distance: {
    color: colors.primary,
    fontWeight: '600',
  },
  line: {
    marginTop: 2,
    color: '#424242',
  },
  lineActive: {
    color: '#2e7d32',
    fontWeight: '600',
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
  hint: {
    marginTop: 6,
    fontSize: 12,
    color: colors.muted,
  },
  actions: {
    marginTop: 12,
    gap: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
    minHeight: 44,
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
    textAlign: 'center',
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
