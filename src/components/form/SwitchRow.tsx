import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors } from './theme';

interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
}: SwitchRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text style={styles.label}>{label}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  texts: {
    flex: 1,
  },
  label: {
    color: colors.text,
  },
  description: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 13,
  },
});
