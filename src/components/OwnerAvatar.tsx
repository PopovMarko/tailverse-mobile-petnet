import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { nicknameInitial } from '../utils/profile';
import { colors } from './form/theme';

interface OwnerAvatarProps {
  /** Photo URL; null (or a photo that fails to load) shows the nickname's initial. */
  url: string | null;
  nickname: string;
  size: number;
}

/** Round owner photo, or the first letter of the nickname without one. */
export function OwnerAvatar({ url, nickname, size }: OwnerAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = url !== null && url !== failedUrl;
  const shape = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.circle, shape]}>
      {showPhoto ? (
        <Image
          source={{ uri: url }}
          style={shape}
          onError={() => setFailedUrl(url)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.45 }]}>
          {nicknameInitial(nickname)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.primaryLight,
  },
  initial: {
    color: colors.primary,
    fontWeight: '700',
  },
});
