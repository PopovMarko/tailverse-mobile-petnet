import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type CameraOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';

import type { UploadFile } from '../../types';
import { colors } from './theme';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Downscaled JPEG: small enough to upload fast and always within the backend's 10 MB / type limits.
const PICKER_OPTIONS: CameraOptions = {
  mediaType: 'photo',
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.8,
};

interface AvatarPickerProps {
  value: UploadFile | null;
  onChange: (file: UploadFile | null) => void;
}

/** Picks a local photo for the avatar; the caller uploads it via POST /uploads. */
export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const [error, setError] = useState<string | null>(null);

  const handleResponse = (response: ImagePickerResponse) => {
    if (response.didCancel) {
      return;
    }
    if (response.errorCode) {
      setError(
        response.errorCode === 'camera_unavailable'
          ? 'Камера недоступна'
          : response.errorCode === 'permission'
          ? 'Нет доступа к фото. Разрешите его в настройках'
          : 'Не удалось выбрать фото',
      );
      return;
    }
    const asset = response.assets?.[0];
    if (!asset?.uri) {
      return;
    }
    if (asset.fileSize !== undefined && asset.fileSize > MAX_FILE_SIZE) {
      setError('Фото слишком большое (максимум 10 МБ)');
      return;
    }
    setError(null);
    onChange({
      uri: asset.uri,
      type: asset.type ?? 'image/jpeg',
      name: asset.fileName ?? 'avatar.jpg',
    });
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
        {value ? (
          <Image source={{ uri: value.uri }} style={styles.image} />
        ) : (
          <Text style={styles.placeholder}>📷</Text>
        )}
      </Pressable>
      <View style={styles.actions}>
        <Pressable onPress={pick} accessibilityRole="button">
          <Text style={styles.link}>
            {value ? 'Изменить фото' : 'Добавить фото'}
          </Text>
        </Pressable>
        {value ? (
          <Pressable onPress={() => onChange(null)} accessibilityRole="button">
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
