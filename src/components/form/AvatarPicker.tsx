import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';

import type { UploadFile } from '../../types';
import {
  assetToUploadFile,
  isTooLarge,
  pickerErrorMessage,
  pickerOptions,
} from '../../utils/imagePicker';
import { colors } from './theme';

const PICKER_OPTIONS = pickerOptions(1024);

interface AvatarPickerProps {
  /** A newly picked local photo. */
  value: UploadFile | null;
  /** null — "Удалить" was tapped (removes the picked photo and `currentUrl`). */
  onChange: (file: UploadFile | null) => void;
  /** The photo already saved in the profile, shown while no new one is picked. */
  currentUrl?: string | null;
}

/** Picks a local photo for the avatar; the caller uploads it via POST /uploads. */
export function AvatarPicker({
  value,
  onChange,
  currentUrl = null,
}: AvatarPickerProps) {
  const shownUri = value?.uri ?? currentUrl;
  const [error, setError] = useState<string | null>(null);

  const handleResponse = (response: ImagePickerResponse) => {
    if (response.didCancel) {
      return;
    }
    const pickerError = pickerErrorMessage(response);
    if (pickerError) {
      setError(pickerError);
      return;
    }
    const asset = response.assets?.[0];
    const file = asset && assetToUploadFile(asset, 'avatar.jpg');
    if (!asset || !file) {
      return;
    }
    if (isTooLarge(asset)) {
      setError('Фото слишком большое (максимум 10 МБ)');
      return;
    }
    setError(null);
    onChange(file);
  };

  const pick = () => {
    Alert.alert('Фото профиля', undefined, [
      {
        text: 'Выбрать из галереи',
        onPress: () =>
          launchImageLibrary({ ...PICKER_OPTIONS, selectionLimit: 1 }).then(
            handleResponse,
          ),
      },
      {
        text: 'Сделать фото',
        onPress: () => launchCamera(PICKER_OPTIONS).then(handleResponse),
      },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={pick}
        accessibilityRole="button"
        accessibilityLabel="Выбрать фото профиля"
        style={styles.avatar}
      >
        {shownUri ? (
          <Image source={{ uri: shownUri }} style={styles.image} />
        ) : (
          <Text style={styles.placeholder}>📷</Text>
        )}
      </Pressable>
      <View style={styles.actions}>
        <Pressable onPress={pick} accessibilityRole="button">
          <Text style={styles.link}>
            {shownUri ? 'Изменить фото' : 'Добавить фото'}
          </Text>
        </Pressable>
        {shownUri ? (
          <Pressable
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel="Удалить фото"
          >
            <Text style={[styles.link, styles.remove]}>Удалить</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const AVATAR_SIZE = 80;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  placeholder: {
    fontSize: 28,
  },
  actions: {
    flex: 1,
    gap: 6,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
  remove: {
    color: colors.error,
  },
  error: {
    color: colors.error,
    fontSize: 13,
  },
});
