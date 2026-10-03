import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PostCard } from '../components/PostCard';
import { SpotFilterSheet } from '../components/SpotFilterSheet';
import { PrimaryButton } from '../components/form/PrimaryButton';
import { colors } from '../components/form/theme';
import { useNow } from '../hooks/useNow';
import type { RootTabScreenProps } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { useFeedStore } from '../store/feedStore';
import { petNameOf } from '../store/nameCache';
import type { Id, Post } from '../types';
import { describeDeletePostError } from '../utils/posts';

/**
 * The "Лента" tab: posts of all pets, newest first, loaded page by page as the
 * user scrolls; optionally only the posts about one walk spot.
 */
export function FeedScreen({ navigation, route }: RootTabScreenProps<'Feed'>) {
  const posts = useFeedStore(state => state.posts);
  const status = useFeedStore(state => state.status);
  const error = useFeedStore(state => state.error);
  const refreshing = useFeedStore(state => state.refreshing);
  const loadingMore = useFeedStore(state => state.loadingMore);
  const loadMoreError = useFeedStore(state => state.loadMoreError);
  const hasMore = useFeedStore(state => state.nextCursor !== null);
  const spotId = useFeedStore(state => state.spotId);
  const petNames = useFeedStore(state => state.petNames);
  const spots = useFeedStore(state => state.spots);
  const loadFirstPage = useFeedStore(state => state.loadFirstPage);
  const loadMore = useFeedStore(state => state.loadMore);
  const refresh = useFeedStore(state => state.refresh);
  const setSpotFilter = useFeedStore(state => state.setSpotFilter);
  const deletePost = useFeedStore(state => state.deletePost);
  const myPets = useAuthStore(state => state.pets);

  const now = useNow(60_000);
  const listRef = useRef<FlatList<Post>>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<Id>>(new Set());

  // Opened for a place (e.g. from the map): apply the filter once and drop the
  // param; otherwise the first visit loads the whole feed.
  const paramSpot = route.params?.spot;
  useEffect(() => {
    if (paramSpot) {
      const { id, name, lat, lng } = paramSpot;
      setSpotFilter(id, { name, lat, lng });
      navigation.setParams({ spot: undefined });
    } else if (useFeedStore.getState().status === 'idle') {
      loadFirstPage();
    }
  }, [paramSpot, navigation, setSpotFilter, loadFirstPage]);

  // Another filter is another list: start it from the top.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [spotId]);

  const myPetIds = useMemo(() => new Set(myPets.map(pet => pet.id)), [myPets]);

  const confirmDelete = useCallback(
    (post: Post) => {
      Alert.alert('Удалить пост?', 'Его нельзя будет восстановить.', [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setDeletingIds(ids => new Set(ids).add(post.id));
            try {
              await deletePost(post.id);
            } catch (deleteError) {
              Alert.alert(
                'Не удалось удалить пост',
                describeDeletePostError(deleteError),
              );
            } finally {
              setDeletingIds(ids => {
                const next = new Set(ids);
                next.delete(post.id);
                return next;
              });
            }
          },
        },
      ]);
    },
    [deletePost],
  );

  const filterSpotName = spotId ? spots[spotId]?.name ?? 'Площадка' : null;

  const header = (
    <View style={styles.header}>
      <PrimaryButton
        title="Написать пост"
        onPress={() => navigation.navigate('CreatePost')}
      />
      {spotId ? (
        <View style={styles.filterRow}>
          <View style={[styles.chip, styles.chipActive]}>
            <Pressable
              onPress={() => setFilterOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Выбрать другое место"
              style={styles.chipLabel}
            >
              <Text style={styles.chipActiveText} numberOfLines={1}>
                📍 {filterSpotName}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSpotFilter(null)}
              accessibilityRole="button"
              accessibilityLabel="Сбросить фильтр"
              hitSlop={10}
            >
              <Text style={styles.chipActiveText}>✕</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.filterRow}>
          <Text style={styles.caption}>Все питомцы, новые сверху</Text>
          <Pressable
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Фильтр по месту"
            hitSlop={8}
            style={styles.chip}
          >
            <Text style={styles.chipText}>📍 Все места ▾</Text>
          </Pressable>
        </View>
      )}
      {status === 'error' && posts.length > 0 && (
        <Text style={styles.error}>Не удалось обновить: {error}</Text>
      )}
    </View>
  );

  let empty;
  if (status === 'error') {
    empty = (
      <View style={styles.empty}>
        <Text style={styles.error}>Не удалось загрузить ленту: {error}</Text>
        <Pressable
          onPress={loadFirstPage}
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
          {spotId ? 'Об этом месте пока не писали' : 'Пока нет постов'}
        </Text>
        <Text style={styles.muted}>
          Расскажите, как прошла прогулка, — с фото и местом, где гуляли.
        </Text>
      </View>
    );
  } else {
    empty = <ActivityIndicator style={styles.loader} />;
  }

  let footer;
  if (loadingMore) {
    footer = <ActivityIndicator style={styles.footer} />;
  } else if (loadMoreError) {
    footer = (
      <View style={[styles.footer, styles.empty]}>
        <Text style={styles.error}>
          Не удалось загрузить ещё: {loadMoreError}
        </Text>
        <Pressable
          onPress={loadMore}
          accessibilityRole="button"
          accessibilityLabel="Загрузить ещё"
          hitSlop={8}
        >
          <Text style={styles.link}>Повторить</Text>
        </Pressable>
      </View>
    );
  } else if (!hasMore && status === 'success' && posts.length > 0) {
    footer = <Text style={[styles.muted, styles.footer]}>Это все посты</Text>;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.content}
        data={posts}
        keyExtractor={item => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            petName={petNameOf(item.pet_id, petNames, myPets)}
            spotName={
              item.spot_id
                ? spots[item.spot_id] === null
                  ? null
                  : spots[item.spot_id]?.name
                : undefined
            }
            mine={myPetIds.has(item.pet_id)}
            now={now}
            deleting={deletingIds.has(item.id)}
            onSpotPress={setSpotFilter}
            onDelete={confirmDelete}
          />
        )}
        ItemSeparatorComponent={Separator}
        onEndReached={() => {
          // A failed page waits for "Повторить" instead of retrying on every scroll.
          if (!loadMoreError) {
            loadMore();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      />
      {filterOpen && (
        <SpotFilterSheet
          selectedId={spotId}
          onSelect={spot => {
            setFilterOpen(false);
            if (spot) {
              const { id, name, lat, lng } = spot;
              setSpotFilter(id, { name, lat, lng });
            } else {
              setSpotFilter(null);
            }
          }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  list: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 12,
    gap: 10,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  caption: {
    flex: 1,
    color: colors.muted,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    flexShrink: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  chipLabel: {
    flexShrink: 1,
  },
  chipText: {
    color: colors.text,
  },
  chipActiveText: {
    color: colors.primary,
    fontWeight: '600',
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
  footer: {
    paddingVertical: 16,
  },
});
