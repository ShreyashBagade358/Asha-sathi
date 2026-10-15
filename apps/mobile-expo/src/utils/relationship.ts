/**
 * The family vocabulary shared by every form and list that shows household
 * membership. One list here keeps the register form, the household add-member
 * modal and the member chips agreeing on both the stored value and its label.
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

export function relationshipOptions(t: (key: string) => string): { label: string; value: string }[] {
  return RELATIONSHIPS.map((value) => ({ label: t(RELATIONSHIP_LABEL_KEYS[value]), value }));
}

/** Label for a stored relationship, falling back to the raw value or '—'. */
export function relationshipLabel(
  value: string | null | undefined,
  t: (key: string) => string,
): string {
  if (!value) return '—';
  const key = RELATIONSHIP_LABEL_KEYS[value as Relationship];
  return key ? t(key) : value;
}
