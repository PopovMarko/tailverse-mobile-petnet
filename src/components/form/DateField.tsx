import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';

import type { DateString } from '../../types';
import { formatDate, parseDateString, toDateString } from '../../utils/date';
import { colors } from './theme';

interface DateFieldProps {
  label: string;
  value: DateString | null;
  onChange: (value: DateString | null) => void;
  placeholder?: string;
  hint?: string;
  maximumDate?: Date;
  /** Shown preselected when the picker opens with no value. */
  initialDate?: Date;
  /** Offer "Очистить" for a set date (default true). */
  clearable?: boolean;
}

/** Optional calendar date: native picker (inline spinner on iOS, dialog on Android) plus "clear". */
export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Не указана',
  hint,
  maximumDate,
  initialDate,
  clearable = true,
}: DateFieldProps) {
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const current =
    (value ? parseDateString(value) : null) ?? initialDate ?? new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        maximumDate,
        onValueChange: (_event, date) => onChange(toDateString(date)),
      });
      return;
    }
    if (!value) {
      onChange(toDateString(current));
    }
    setIosPickerOpen(isOpen => !isOpen);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={[styles.field, iosPickerOpen && styles.fieldActive]}
        >
          <Text style={value ? styles.value : styles.placeholder}>
            {value ? formatDate(value) : placeholder}
          </Text>
        </Pressable>
        {value && clearable ? (
          <Pressable
            onPress={() => {
              setIosPickerOpen(false);
              onChange(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Очистить дату"
            hitSlop={8}
          >
            <Text style={styles.clear}>Очистить</Text>
          </Pressable>
        ) : null}
      </View>
      {Platform.OS === 'ios' && iosPickerOpen ? (
        <View>
          <DateTimePicker
            value={current}
            mode="date"
            display="spinner"
            locale="ru-RU"
            maximumDate={maximumDate}
            onValueChange={(_event, date) => onChange(toDateString(date))}
          />
          <Pressable
            onPress={() => setIosPickerOpen(false)}
            accessibilityRole="button"
            style={styles.done}
          >
            <Text style={styles.clear}>Готово</Text>
          </Pressable>
        </View>
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
    alignItems: 'center',
    gap: 12,
  },
  field: {
    flex: 1,
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
  value: {
    fontSize: 16,
    color: colors.text,
  },
  placeholder: {
    fontSize: 16,
    color: colors.muted,
  },
  clear: {
    color: colors.primary,
    fontWeight: '600',
  },
  done: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  hint: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
  },
});
