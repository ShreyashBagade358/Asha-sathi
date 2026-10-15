/**
 * The family vocabulary shared by every form and list that shows household
 * membership. Mirrors the mobile helper so both clients store the same values
 * and show the same labels.
 */

export const RELATIONSHIPS = [
  'head',
  'spouse',
  'son',
  'daughter',
  'father',
  'mother',
  'grandparent',
  'other',
] as const;

export type Relationship = (typeof RELATIONSHIPS)[number];

export const RELATIONSHIP_LABEL_KEYS: Record<Relationship, string> = {
  head: 'asha.relHead',
  spouse: 'asha.relSpouse',
  son: 'asha.relSon',
  daughter: 'asha.relDaughter',
  father: 'asha.relFather',
  mother: 'asha.relMother',
  grandparent: 'asha.relGrandparent',
  other: 'asha.relOther',
};

/** English fallback for pages that render without the i18n hook (PHC forms). */
export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  head: 'Head',
  spouse: 'Spouse',
  son: 'Son',
  daughter: 'Daughter',
  father: 'Father',
  mother: 'Mother',
  grandparent: 'Grandparent',
  other: 'Other',
};

export function relationshipOptions(
  t: (key: string) => string,
): { label: string; value: string }[] {
  return RELATIONSHIPS.map((value) => ({ label: t(RELATIONSHIP_LABEL_KEYS[value]), value }));
}

/**
 * Label for a stored relationship, falling back to the raw value or '—'.
 * `t` is optional so the hardcoded-English PHC pages can call it too.
 */
export function relationshipLabel(
  value: string | null | undefined,
  t?: (key: string) => string,
): string {
  if (!value) return '—';
  const key = RELATIONSHIP_LABEL_KEYS[value as Relationship];
  if (key && t) return t(key);
  return RELATIONSHIP_LABELS[value as Relationship] ?? value;
}
