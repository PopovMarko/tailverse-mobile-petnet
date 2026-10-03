import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';

import type { PhotoUpload } from '../hooks/usePhotoUploads';
import type { UploadFile } from '../types';
import {
  assetToUploadFile,
  isTooLarge,
  pickerErrorMessage,
  pickerOptions,
} from '../utils/imagePicker';
import { colors } from './form/theme';

// Big enough for a full-width photo in the feed, still a few hundred KB.
const PICKER_OPTIONS = pickerOptions(1600);

interface PostPhotosPickerProps {
  photos: PhotoUpload[];
  /** How many photos a post may have. */
  max: number;
  onAdd: (files: UploadFile[]) => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
}

/**
 * Photos of a new post: thumbnails with their upload state (spinner, error with
 * retry), removable, plus a tile that adds more from the gallery or the camera.
 */
export function PostPhotosPicker({
  photos,
  max,
  onAdd,
  onRemove,
  onRetry,
}: PostPhotosPickerProps) {
  const [error, setError] = useState<string | null>(null);
  const left = max - photos.length;

  const handleResponse = (response: ImagePickerResponse) => {
    if (response.didCancel) {
      return;
    }
    const pickerError = pickerErrorMessage(response);
    if (pickerError) {
      setError(pickerError);
      return;
    }
    const assets = (response.assets ?? []).slice(0, left);
    const files: UploadFile[] = [];
    let skipped = 0;
    assets.forEach((asset, index) => {
      const file = assetToUploadFile(asset, `photo-${index + 1}.jpg`);
      if (!file || isTooLarge(asset)) {
        skipped++;
      } else {
        files.push(file);
      }
    });
    setError(
      skipped > 0 ? 'Некоторые фото слишком большие (максимум 10 МБ)' : null,
    );
    if (files.length > 0) {
      onAdd(files);
    }
  };

  const pick = () => {
    Alert.alert('Фото прогулки', undefined, [
      {
        text: 'Выбрать из галереи',
        onPress: () =>
          launchImageLibrary({ ...PICKER_OPTIONS, selectionLimit: left }).then(
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
      <Text style={styles.label}>
        Фото{photos.length > 0 ? ` · ${photos.length} из ${max}` : ''}
      </Text>
      <View style={styles.grid}>
        {photos.map((photo, index) => (
          <View key={photo.key} style={styles.tile}>
            <Image source={{ uri: photo.file.uri }} style={styles.image} />
            {photo.status === 'uploading' && (
              <View
                style={[styles.overlay, styles.overlayBusy]}
                accessibilityLabel={`Фото ${index + 1} загружается`}
              >
                <ActivityIndicator color="#ffffff" />
              </View>
            )}
            {photo.status === 'error' && (
              <Pressable
                onPress={() => onRetry(photo.key)}
                accessibilityRole="button"
                accessibilityLabel={`Повторить загрузку фото ${index + 1}`}
                style={[styles.overlay, styles.overlayError]}
              >
                <Text style={styles.overlayText}>{photo.error}</Text>
                <Text style={[styles.overlayText, styles.retry]}>
                  Повторить
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => onRemove(photo.key)}
              accessibilityRole="button"
              accessibilityLabel={`Убрать фото ${index + 1}`}
              hitSlop={8}
              style={styles.remove}
            >
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ))}
        {left > 0 && (
          <Pressable
            onPress={pick}
            accessibilityRole="button"
            accessibilityLabel="Добавить фото"
            style={[styles.tile, styles.add]}
          >
            <Text style={styles.addIcon}>📷</Text>
            <Text style={styles.addText}>Добавить</Text>
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const TILE_SIZE = 96;

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontWeight: '600',
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  image: {
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  overlayBusy: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  overlayError: {
    backgroundColor: 'rgba(198, 40, 40, 0.8)',
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 11,
    textAlign: 'center',
  },
  retry: {
    marginTop: 2,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  removeText: {
    color: '#ffffff',
    fontSize: 12,
  },
  add: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  addIcon: {
    fontSize: 24,
  },
  addText: {
    marginTop: 2,
    color: colors.primary,
    fontWeight: '600',
  },
  error: {
    marginTop: 6,
    color: colors.error,
    fontSize: 13,
  },
});
