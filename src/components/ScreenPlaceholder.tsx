import { StyleSheet, Text, View } from 'react-native';

interface ScreenPlaceholderProps {
  title: string;
}

/** Temporary screen body: the screen name centered. Replaced as screens get real content. */
export function ScreenPlaceholder({ title }: ScreenPlaceholderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
});
