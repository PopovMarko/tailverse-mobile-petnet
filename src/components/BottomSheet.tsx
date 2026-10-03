import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { colors } from './form/theme';

interface BottomSheetProps {
  /** Fixed part above the scrolling content (title etc.). */
  header?: ReactNode;
  children: ReactNode;
  /** Called by the ✕ button and by swiping the sheet down. */
  onClose: () => void;
  /** Tallest the sheet may get, as a share of the window height. */
  maxHeightRatio?: number;
}

const CLOSE_DISTANCE = 80;
const CLOSE_VELOCITY = 0.8;

/**
 * Panel that slides up from the bottom over the screen content (not modal: the
 * map behind stays usable). Grows with its content up to `maxHeightRatio` of the
 * window, then scrolls. Drag the handle/header down to close.
 */
export function BottomSheet({
  header,
  children,
  onClose,
  maxHeightRatio = 0.6,
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }, [translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_event, gesture) => {
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > CLOSE_DISTANCE || gesture.vy > CLOSE_VELOCITY) {
            Animated.timing(translateY, {
              toValue: windowHeight,
              duration: 180,
              useNativeDriver: true,
            }).start(() => onCloseRef.current());
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
            }).start();
          }
        },
      }),
    [translateY, windowHeight],
  );

  return (
    <Animated.View
      style={[
        styles.sheet,
        { maxHeight: windowHeight * maxHeightRatio },
        { transform: [{ translateY }] },
      ]}
    >
      <View {...panResponder.panHandlers} style={styles.top}>
        <View style={styles.handle} />
        <Pressable
          style={styles.close}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        {header}
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.background,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  top: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 1,
  },
  closeText: {
    fontSize: 18,
    color: colors.muted,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
