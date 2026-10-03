import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Id, Post } from '../types';
import { formatPostTime } from '../utils/date';
import { colors } from './form/theme';

interface PostCardProps {
  post: Post;
  petName: string | null;
  /** Name of the tagged spot: undefined — not loaded yet, null — the spot is gone. */
  spotName: string | null | undefined;
  /** Written on behalf of one of the signed-in owner's pets. */
  mine: boolean;
  now: Date;
  /** The post is being deleted. */
  deleting: boolean;
  /** The place tag was tapped (shows the posts of that place). */
  onSpotPress: (spotId: Id) => void;
  /** The pet's name was tapped (opens its profile). */
  onPetPress?: (petId: Id) => void;
  /** "Удалить" of an own post was tapped; the screen asks for confirmation. */
  onDelete: (post: Post) => void;
}

/** One post of the feed: pet, time, text, photos and the place tag. */
export function PostCard({
  post,
  petName,
  spotName,
  mine,
  now,
  deleting,
  onSpotPress,
  onPetPress,
  onDelete,
}: PostCardProps) {
  const name = petName ?? 'Питомец';
  const spotId = post.spot_id;

  return (
    <View style={[styles.card, deleting && styles.deleting]}>
      <View style={styles.top}>
        <View style={styles.author}>
          <Pressable
            onPress={onPetPress && (() => onPetPress(post.pet_id))}
            disabled={!onPetPress}
            accessibilityRole="button"
            accessibilityLabel={`Профиль питомца ${name}`}
            hitSlop={4}
            style={styles.petLink}
          >
            <Text style={styles.pet} numberOfLines={1}>
              🐾 {name}
              {mine && <Text style={styles.mine}> · ваш</Text>}
            </Text>
          </Pressable>
          <Text style={styles.time}>
            {formatPostTime(post.created_at, now)}
          </Text>
        </View>
        {mine &&
          (deleting ? (
            <ActivityIndicator size="small" />
          ) : (
            <Pressable
              onPress={() => onDelete(post)}
              accessibilityRole="button"
              accessibilityLabel={`Удалить пост: ${name}`}
              hitSlop={8}
            >
              <Text style={styles.delete}>Удалить</Text>
            </Pressable>
          ))}
      </View>

      {post.text ? <Text style={styles.text}>{post.text}</Text> : null}

      {post.photo_urls.length > 0 && <PhotoPager urls={post.photo_urls} />}

      {spotId && spotName !== null && (
        <Pressable
          onPress={() => onSpotPress(spotId)}
          accessibilityRole="button"
          accessibilityLabel={`Посты места ${spotName ?? 'Площадка'}`}
          hitSlop={4}
          style={styles.spot}
        >
          <Text style={styles.spotText} numberOfLines={1}>
            📍 {spotName ?? 'Площадка'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Photos of a post, swiped one by one, with "2/5" when there are several. */
function PhotoPager({ urls }: { urls: string[] }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  return (
    <View
      style={styles.pager}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={event =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
        >
          {urls.map((url, position) => (
            <Image
              key={`${position}-${url}`}
              source={{ uri: url }}
              style={{ width, height: width * PHOTO_RATIO }}
              resizeMode="cover"
              accessibilityLabel={`Фото ${position + 1} из ${urls.length}`}
            />
          ))}
        </ScrollView>
      )}
      {urls.length > 1 && (
        <Text style={styles.counter}>
          {Math.min(index, urls.length - 1) + 1}/{urls.length}
        </Text>
      )}
    </View>
  );
}

/** Height to width of the photo area (4:3 landscape). */
const PHOTO_RATIO = 3 / 4;

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: colors.background,
    gap: 8,
  },
  deleting: {
    opacity: 0.5,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  author: {
    flex: 1,
  },
  petLink: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  pet: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  mine: {
    fontWeight: '400',
    color: colors.primary,
  },
  time: {
    marginTop: 2,
    fontSize: 13,
    color: colors.muted,
  },
  delete: {
    color: colors.error,
    fontWeight: '600',
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  pager: {
    aspectRatio: 1 / PHOTO_RATIO,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  counter: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    fontSize: 12,
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  spot: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  spotText: {
    color: colors.primary,
    fontWeight: '600',
  },
});
