import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../components/form/theme';

const PLANNED = [
  { icon: '🐕', text: 'Выгул и передержка, когда вы заняты' },
  { icon: '✂️', text: 'Груминг и стрижка' },
  { icon: '🩺', text: 'Ветеринары поблизости' },
  { icon: '🎓', text: 'Кинологи и дрессировка' },
];

/**
 * The «Услуги» tab — a "coming soon" page. How services will work (a partner
 * network or owners helping each other) is not decided yet, so there is no logic
 * and no API calls here.
 */
export function ServicesScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.icon}>🛠️</Text>
      <Text style={styles.title}>Услуги — скоро</Text>
      <Text style={styles.body}>
        Здесь появятся услуги для питомцев рядом с вами. Мы ещё решаем, как
        лучше это устроить, и обязательно расскажем, когда раздел заработает.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Например</Text>
        {PLANNED.map(item => (
          <View key={item.text} style={styles.row}>
            <Text style={styles.rowIcon}>{item.icon}</Text>
            <Text style={styles.rowText}>{item.text}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.muted}>
        А пока загляните в «Куда пойти» — там места для прогулок рядом.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    textAlign: 'center',
    color: colors.text,
    lineHeight: 21,
  },
  card: {
    alignSelf: 'stretch',
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.background,
    gap: 10,
  },
  cardTitle: {
    fontWeight: '700',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowIcon: {
    fontSize: 20,
  },
  rowText: {
    flex: 1,
    color: colors.text,
  },
  muted: {
    textAlign: 'center',
    color: colors.muted,
  },
});
