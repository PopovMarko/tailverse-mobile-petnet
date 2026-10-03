import type { Ref } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputInstance, TextInputProps } from 'react-native';

import { colors } from './theme';

interface FormFieldProps extends TextInputProps {
  ref?: Ref<TextInputInstance>;
  label: string;
  error?: string | null;
  hint?: string;
}

/** Labelled text input with an optional hint and validation error below it. */
export function FormField({
  ref,
  label,
  error,
  hint,
  style,
  ...inputProps
}: FormFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    marginTop: 4,
    color: colors.error,
    fontSize: 13,
  },
  hint: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
  },
});
