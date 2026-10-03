import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NearbySpotsPicker } from '../../components/NearbySpotsPicker';
import { ChoiceChips, type Choice } from '../../components/form/ChoiceChips';
import { DateTimeField } from '../../components/form/DateTimeField';
import { FormField } from '../../components/form/FormField';
import { FormScreen } from '../../components/form/FormScreen';
import { PrimaryButton } from '../../components/form/PrimaryButton';
import { colors } from '../../components/form/theme';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAnnouncementsStore } from '../../store/announcementsStore';
import { useAuthStore } from '../../store/authStore';
import { useLocationStore } from '../../store/locationStore';
import type { GeoPoint } from '../../types';
import {
  DURATION_PRESETS,
  MAX_DURATION_MIN,
  MAX_START_AHEAD_DAYS,
  describeCreateError,
  parseDurationInput,
  validateAnnouncementForm,
  type AnnouncementFormErrors,
  type PlaceSpot,
  type WalkPlace,
} from '../../utils/announcements';
import { formatDuration, roundUpToMinutes } from '../../utils/date';

type DurationChoice = `${(typeof DURATION_PRESETS)[number]}` | 'custom';

const DURATION_OPTIONS: Choice<DurationChoice>[] = [
  ...DURATION_PRESETS.map(minutes => ({
    value: `${minutes}` as DurationChoice,
    label: formatDuration(minutes),
  })),
  { value: 'custom', label: 'Другая' },
];

type PlaceMode = 'nearby' | 'point';

const PLACE_MODES: Choice<PlaceMode>[] = [
  { value: 'nearby', label: 'Рядом со мной' },
  { value: 'point', label: 'Точка на карте' },
];

/** Default start: now rounded up to the next quarter of an hour. */
export function defaultStart(now: Date = new Date()): Date {
  return roundUpToMinutes(now, 15);
}

function formatPoint(point: GeoPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

/**
 * "Иду гулять": the owner announces a walk with one of their pets — when, for how
 * long and where (a walk spot within 500 m, or a point picked on the map).
 */
export function CreateAnnouncementScreen({
  navigation,
  route,
}: RootStackScreenProps<'CreateAnnouncement'>) {
  const pets = useAuthStore(state => state.pets);
  const createAnnouncement = useAnnouncementsStore(
    state => state.createAnnouncement,
  );
  const checkPermission = useLocationStore(state => state.checkPermission);

  const presetSpot = route.params?.spot ?? null;
  const pickedPoint = route.params?.pickedPoint ?? null;

  const [petId, setPetId] = useState<string | null>(() =>
    pets.length === 1 ? pets[0]!.id : null,
  );
  const [startsAt, setStartsAt] = useState(() => defaultStart());
  const [durationChoice, setDurationChoice] = useState<DurationChoice>('60');
  const [customDuration, setCustomDuration] = useState('');
  const [mode, setMode] = useState<PlaceMode>('nearby');
  const [spot, setSpot] = useState<PlaceSpot | null>(presetSpot);
  const [point, setPoint] = useState<GeoPoint | null>(null);

  const [errors, setErrors] = useState<AnnouncementFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Locates the user for the nearby spots when access was granted before (never prompts).
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // The map picker returns its point through the route params.
  useEffect(() => {
    if (pickedPoint) {
      setPoint(pickedPoint);
      setMode('point');
      setErrors(current => ({ ...current, place: undefined }));
    }
  }, [pickedPoint]);

  const petOptions = useMemo(
    () => pets.map(pet => ({ value: pet.id, label: pet.name })),
    [pets],
  );

  const durationMin =
    durationChoice === 'custom'
      ? parseDurationInput(customDuration)
      : Number(durationChoice);

  // Only the active mode's choice is the place: the request carries exactly one.
  const place: WalkPlace | null =
    mode === 'nearby'
      ? spot && { kind: 'spot', spot }
      : point && { kind: 'point', point };

  const openMapPicker = () => {
    setMode('point');
    navigation.navigate('PickWalkPoint', point ? { initial: point } : {});
  };

  const submit = async () => {
    const nextErrors = validateAnnouncementForm({
      petId,
      startsAt,
      durationMin,
      place,
    });
    setErrors(nextErrors);
    if (
      Object.keys(nextErrors).length > 0 ||
      !petId ||
      !place ||
      durationMin === null
    ) {
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await createAnnouncement({ petId, startsAt, durationMin, place });
      navigation.popTo('Tabs', { screen: 'GoWalk' });
    } catch (error) {
      setFormError(describeCreateError(error));
      setSubmitting(false);
    }
  };

  const now = new Date();
  const maximumDate = new Date(
    now.getTime() + MAX_START_AHEAD_DAYS * 24 * 3600_000,
  );

  return (
    <FormScreen>
      {pets.length > 1 || !petId ? (
        <ChoiceChips
          label="Кто идёт гулять"
          options={petOptions}
          value={petId}
          onChange={setPetId}
          error={errors.pet}
        />
      ) : (
        <View style={styles.block}>
          <Text style={styles.label}>Кто идёт гулять</Text>
          <Text style={styles.value}>🐾 {pets[0]?.name}</Text>
        </View>
      )}

      <DateTimeField
        label="Начало"
        value={startsAt}
        onChange={value => {
          setStartsAt(value);
          setErrors(current => ({ ...current, startsAt: undefined }));
        }}
        minimumDate={now}
        maximumDate={maximumDate}
        error={errors.startsAt}
      />

      <ChoiceChips
        label="Примерная длительность"
        options={DURATION_OPTIONS}
        value={durationChoice}
        onChange={setDurationChoice}
        error={durationChoice === 'custom' ? null : errors.duration}
      />
      {durationChoice === 'custom' ? (
        <FormField
          label="Длительность, минут"
          value={customDuration}
          onChangeText={setCustomDuration}
          keyboardType="number-pad"
          placeholder="Например, 45"
          maxLength={3}
          error={errors.duration}
          hint={`От 1 минуты до ${formatDuration(MAX_DURATION_MIN)}`}
        />
      ) : null}

      <ChoiceChips
        label="Где"
        options={PLACE_MODES}
        value={mode}
        onChange={setMode}
      />
      <View style={styles.block}>
        {mode === 'nearby' ? (
          <NearbySpotsPicker
            selected={spot}
            onSelect={value => {
              setSpot(value);
              setErrors(current => ({ ...current, place: undefined }));
            }}
            onPickOnMap={openMapPicker}
          />
        ) : point ? (
          <View style={styles.point}>
            <Text style={styles.value}>📌 Точка на карте</Text>
            <Text style={styles.muted}>{formatPoint(point)}</Text>
            <PrimaryButton
              title="Изменить на карте"
              variant="secondary"
              onPress={openMapPicker}
            />
          </View>
        ) : (
          <View style={styles.point}>
            <Text style={styles.muted}>
              Отметьте на карте, где будете гулять, — например, если рядом нет
              площадки.
            </Text>
            <PrimaryButton
              title="Выбрать точку на карте"
              variant="secondary"
              onPress={openMapPicker}
            />
          </View>
        )}
        {errors.place ? (
          <Text style={styles.fieldError}>{errors.place}</Text>
        ) : null}
      </View>

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <PrimaryButton
        title="Объявить прогулку"
        onPress={submit}
        loading={submitting}
        style={styles.submit}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontWeight: '600',
    color: colors.text,
  },
  value: {
    fontSize: 16,
    color: colors.text,
  },
  muted: {
    color: colors.muted,
    lineHeight: 20,
  },
  point: {
    gap: 8,
  },
  fieldError: {
    marginTop: 4,
    color: colors.error,
    fontSize: 13,
  },
  formError: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
    color: colors.error,
    backgroundColor: colors.errorLight,
  },
  submit: {
    marginTop: 12,
  },
});
