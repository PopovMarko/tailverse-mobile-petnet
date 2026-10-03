import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './theme';

interface FormScreenProps {
  children: ReactNode;
  /** Safe-area edges to pad; screens under a header only need the bottom one. */
  edges?: ('top' | 'bottom')[];
}

/**
 * Scrollable form body. iOS insets the scroll view by the keyboard height;
 * Android resizes the window (windowSoftInputMode="adjustResize").
 */
export function FormScreen({ children, edges = ['bottom'] }: FormScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
});
