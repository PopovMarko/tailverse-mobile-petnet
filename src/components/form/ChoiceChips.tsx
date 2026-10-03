import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

interface ChoiceChipsProps<T extends string> {
  label: string;
  options: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string | null;
}

/** Single choice from a few options, shown as a row of chips. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: ChoiceChipsProps<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map(option => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.text, selected && styles.textSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontWeight: '600',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  text: {
    color: colors.text,
  },
  textSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  error: {
    marginTop: 4,
    color: colors.error,
    fontSize: 13,
  },
});
