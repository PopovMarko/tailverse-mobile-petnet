import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NearbySpotsPicker } from '../../components/NearbySpotsPicker';
import { PostPhotosPicker } from '../../components/PostPhotosPicker';
import { ChoiceChips } from '../../components/form/ChoiceChips';
import { FormField } from '../../components/form/FormField';
import { FormScreen } from '../../components/form/FormScreen';
import { PrimaryButton } from '../../components/form/PrimaryButton';
import { colors } from '../../components/form/theme';
import {
  useCurrentSpotSuggestion,
  type SpotSuggestionReason,
} from '../../hooks/useCurrentSpotSuggestion';
import { usePhotoUploads } from '../../hooks/usePhotoUploads';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useFeedStore } from '../../store/feedStore';
import type { PlaceSpot } from '../../utils/announcements';
import { formatDistance } from '../../utils/geo';
import {
  MAX_POST_PHOTOS,
  MAX_POST_TEXT_LENGTH,
  describeCreatePostError,
  validatePostForm,
  type PostFormErrors,
} from '../../utils/posts';

/** The place chosen by hand (a spot, or none); `null` — follow the suggestion. */
type ManualPlace = { spot: PlaceSpot | null } | null;

function reasonNote(reason: SpotSuggestionReason, spot: PlaceSpot): string {
  if (reason === 'checkIn') {
    return 'Вы отметились здесь';
  }
  return spot.distance_m !== undefined
    ? `Ближайшая площадка · ${formatDistance(spot.distance_m)} от вас`
    : 'Ближайшая площадка';
}

/**
 * New feed post on behalf of one of the owner's pets: a short story of the walk,
 * photos (uploaded as soon as they are picked) and the place, tagged
 * automatically with where the owner is now and changeable or removable.
 */
export function CreatePostScreen({
  navigation,
}: RootStackScreenProps<'CreatePost'>) {
  const pets = useAuthStore(state => state.pets);
  const createPost = useFeedStore(state => state.createPost);

  const [petId, setPetId] = useState<string | null>(() =>
    pets.length === 1 ? pets[0]!.id : null,
  );
  const [text, setText] = useState('');
  const photos = usePhotoUploads();

  const { suggestion, pending: locatingPlace } =
    useCurrentSpotSuggestion(petId);
  const [manual, setManual] = useState<ManualPlace>(null);
  const [choosingPlace, setChoosingPlace] = useState(false);
  const spot = manual ? manual.spot : suggestion?.spot ?? null;

  const [errors, setErrors] = useState<PostFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const petOptions = useMemo(
    () => pets.map(pet => ({ value: pet.id, label: pet.name })),
    [pets],
  );

  const submit = async () => {
    const nextErrors = validatePostForm({
      petId,
      text,
      photoCount: photos.photos.length,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !petId) {
      return;
    }
    if (photos.uploading) {
      setFormError('Фото ещё загружаются — подождите немного');
      return;
    }
    if (photos.failed) {
      setFormError('Не все фото загрузились: повторите или уберите их');
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await createPost({ petId, text, photoUrls: photos.urls, spot });
      navigation.popTo('Tabs', { screen: 'Feed' });
    } catch (error) {
      setFormError(describeCreatePostError(error));
      setSubmitting(false);
    }
  };

  let place;
  if (choosingPlace) {
    place = (
      <View style={styles.placeBox}>
        <NearbySpotsPicker
          selected={spot}
          onSelect={value => {
            setManual({ spot: value });
            setChoosingPlace(false);
          }}
        />
        <Pressable
          onPress={() => setChoosingPlace(false)}
          accessibilityRole="button"
          accessibilityLabel="Отменить выбор места"
          hitSlop={8}
        >
          <Text style={styles.link}>Отмена</Text>
        </Pressable>
      </View>
    );
  } else if (spot) {
    const note = manual
      ? 'Выбрано вами'
      : suggestion
      ? reasonNote(suggestion.reason, spot)
      : null;
    place = (
      <View style={styles.tag}>
        <View style={styles.tagText}>
          <Text style={styles.tagName} numberOfLines={2}>
            📍 {spot.name}
          </Text>
          {note && <Text style={styles.muted}>{note}</Text>}
        </View>
        <View style={styles.tagActions}>
          <Pressable
            onPress={() => setChoosingPlace(true)}
            accessibilityRole="button"
            accessibilityLabel="Изменить место"
            hitSlop={8}
          >
            <Text style={styles.link}>Изменить</Text>
          </Pressable>
          <Pressable
            onPress={() => setManual({ spot: null })}
            accessibilityRole="button"
            accessibilityLabel="Убрать место"
            hitSlop={8}
          >
            <Text style={[styles.link, styles.remove]}>Убрать</Text>
          </Pressable>
        </View>
      </View>
    );
  } else if (!manual && locatingPlace) {
    place = (
      <View style={styles.row}>
        <ActivityIndicator />
        <Text style={styles.muted}>Определяем, где вы гуляете…</Text>
      </View>
    );
  } else {
    place = (
      <View style={styles.row}>
        <Text style={styles.muted}>Без места</Text>
        <Pressable
          onPress={() => setChoosingPlace(true)}
          accessibilityRole="button"
          accessibilityLabel="Отметить место"
          hitSlop={8}
        >
          <Text style={styles.link}>Отметить место</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FormScreen>
      {pets.length > 1 || !petId ? (
        <ChoiceChips
          label="От имени"
          options={petOptions}
          value={petId}
          onChange={value => {
            setPetId(value);
            setErrors(current => ({ ...current, pet: undefined }));
          }}
          error={errors.pet}
        />
      ) : (
        <View style={styles.block}>
          <Text style={styles.label}>От имени</Text>
          <Text style={styles.value}>🐾 {pets[0]?.name}</Text>
        </View>
      )}

      <FormField
        label="Как прошла прогулка"
        value={text}
        onChangeText={value => {
          setText(value);
          setErrors(current => ({ ...current, text: undefined }));
        }}
        placeholder="Пара слов о прогулке"
        multiline
        maxLength={MAX_POST_TEXT_LENGTH}
        style={styles.textInput}
        error={errors.text}
        hint={
          text.length > MAX_POST_TEXT_LENGTH - 500
            ? `${text.length} из ${MAX_POST_TEXT_LENGTH}`
            : 'Можно без текста, если есть фото'
        }
      />

      <PostPhotosPicker
        photos={photos.photos}
        max={MAX_POST_PHOTOS}
        onAdd={files => {
          photos.add(files);
          setErrors(current => ({ ...current, text: undefined }));
        }}
        onRemove={photos.remove}
        onRetry={photos.retry}
      />

      <View style={styles.block}>
        <Text style={styles.label}>Место</Text>
        {place}
      </View>

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <PrimaryButton
        title="Опубликовать"
        onPress={submit}
        loading={submitting}
        style={styles.submit}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontWeight: '600',
    color: colors.text,
  },
  value: {
    fontSize: 16,
    color: colors.text,
  },
  textInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  muted: {
    color: colors.muted,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
  remove: {
    color: colors.error,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  placeBox: {
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  tagText: {
    flex: 1,
    gap: 2,
  },
  tagName: {
    fontSize: 16,
    color: colors.text,
  },
  tagActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  formError: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
    color: colors.error,
    backgroundColor: colors.errorLight,
  },
  submit: {
    marginTop: 12,
  },
});
