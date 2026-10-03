/** Species the app offers as quick choices; any other value is free text. */
export const KNOWN_SPECIES = [
  { value: 'dog', label: 'Собака' },
  { value: 'cat', label: 'Кошка' },
] as const;

/** Russian name for a species value from the backend ("dog" → "Собака"). */
export function speciesLabel(species: string): string {
  const known = KNOWN_SPECIES.find(item => item.value === species);
  if (known) {
    return known.label;
  }
  return species ? species.charAt(0).toUpperCase() + species.slice(1) : '';
}
