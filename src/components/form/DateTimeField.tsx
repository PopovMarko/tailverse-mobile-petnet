import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';

import { formatDateTime } from '../../utils/date';
import { colors } from './theme';

interface DateTimeFieldProps {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string | null;
  hint?: string;
}

/**
 * Required date and time: an inline spinner on iOS, a date dialog followed by a
 * time dialog on Android.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  error,
  hint,
}: DateTimeFieldProps) {
  const [iosPickerOpen, setIosPickerOpen] = useState(false);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        minimumDate,
        maximumDate,
        onValueChange: (_event, date) => {
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: true,
            onValueChange: (_timeEvent, time) => onChange(time),
          });
        },
      });
      return;
    }
    setIosPickerOpen(isOpen => !isOpen);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          styles.field,
          iosPickerOpen && styles.fieldActive,
          error ? styles.fieldError : null,
        ]}
      >
        <Text style={styles.value}>{formatDateTime(value)}</Text>
      </Pressable>
      {Platform.OS === 'ios' && iosPickerOpen ? (
        <View>
          <DateTimePicker
            value={value}
            mode="datetime"
            display="spinner"
            locale="ru-RU"
            minuteInterval={5}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onValueChange={(_event, date) => onChange(date)}
          />
          <Pressable
            onPress={() => setIosPickerOpen(false)}
            accessibilityRole="button"
            style={styles.done}
          >
            <Text style={styles.action}>Готово</Text>
          </Pressable>
        </View>
      ) : null}
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
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  fieldActive: {
    borderColor: colors.primary,
  },
  fieldError: {
    borderColor: colors.error,
  },
  value: {
    fontSize: 16,
    color: colors.text,
  },
  action: {
    color: colors.primary,
    fontWeight: '600',
  },
  done: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
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
