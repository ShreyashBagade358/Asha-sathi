/**
 * Vaccine reference information for ASHA workers.
 *
 * Keyed by vaccine_code (lowercased, digits stripped) so both NIP codes
 * (BCG, OPV0, HEPB0, PENTA, ROTA, FIPV, MR, VITA, DPT, TT) and legacy
 * seed codes (OPV1, HEP-B0, DPT1, PCV1, ROTA1) resolve correctly.
 *
 * `protects` describes what the vaccine prevents, `schedule` the NIP age,
 * `commonSideEffects` what a caregiver might observe, and `notes` practical
 * advice for the ASHA worker.
 */
export type VaccineInfo = {
  name: string;
  protects: string;
  schedule: string;
  route: string;
  commonSideEffects: string;
  notes: string;
};

const normalize = (code: string): string =>
  code.toLowerCase().replace(/[^a-z]/g, '').replace(/\d+$/, '');

const INFO: Record<string, VaccineInfo> = {
  bcg: {
    name: 'BCG (Bacillus Calmette-Guérin)',
    protects: 'Tuberculosis (TB), especially severe forms like TB meningitis and miliary TB in children.',
    schedule: 'At birth (0 weeks)',
    route: 'Intradermal injection, left upper arm',
    commonSideEffects: 'Small red bump at the injection site that may ulcerate and heal over 4–6 weeks. This is normal and expected.',
    notes: 'Give at birth or as early as possible. The scar is a sign the vaccine took. Do not re-vaccinate if a scar is already present.',
  },
  opv0: {
    name: 'OPV Zero Dose (Oral Polio Vaccine)',
    protects: 'Polio (Poliovirus) — the birth dose kickstarts immunity before the 6-week series.',
    schedule: 'At birth (0 weeks)',
    route: 'Oral (drops)',
    commonSideEffects: 'None usually. Rarely, mild loose stools for a day.',
    notes: 'Give drops directly into the mouth. Do not feed the child for 30 minutes after. Ensure the child does not spit it out.',
  },
  hepb0: {
    name: 'Hepatitis B (Birth Dose)',
    protects: 'Hepatitis B virus infection, which can cause chronic liver disease and liver cancer.',
    schedule: 'At birth (within 24 hours of birth)',
    route: 'Intramuscular injection, anterolateral thigh',
    commonSideEffects: 'Mild pain or swelling at the injection site. Low-grade fever is rare.',
    notes: 'Ideally within 24 hours of birth. If missed, can be given up to 7 days after birth. Essential for preventing mother-to-child transmission.',
  },
  opv: {
    name: 'OPV (Oral Polio Vaccine)',
    protects: 'Polio (Poliovirus). Multiple doses build strong intestinal immunity.',
    schedule: '6 weeks, 10 weeks, 14 weeks (doses 1–3), booster at 16–24 months',
    route: 'Oral (drops)',
    commonSideEffects: 'None usually. Rarely, mild loose stools for a day.',
    notes: 'Give on the scheduled dates. Each dose is important for complete protection. Space doses at least 4 weeks apart.',
  },
  penta: {
    name: 'Pentavalent Vaccine',
    protects: 'Diphtheria, Pertussis (whooping cough), Tetanus, Hepatitis B, and Haemophilus influenzae type b (Hib).',
    schedule: '6 weeks, 10 weeks, 14 weeks (doses 1–3)',
    route: 'Intramuscular injection, anterolateral thigh',
    commonSideEffects: 'Mild pain, redness, or swelling at the injection site. Low-grade fever for 1–2 days. Fussiness is common.',
    notes: 'Always given with OPV at the same visit. If the child has a high fever or is seriously unwell, defer and reschedule. Three doses are essential for full protection.',
  },
  rota: {
    name: 'Rotavirus Vaccine',
    protects: 'Rotavirus — the most common cause of severe diarrhoea and dehydration in infants.',
    schedule: '6 weeks, 10 weeks, 14 weeks (doses 1–3)',
    route: 'Oral (liquid)',
    commonSideEffects: 'Mild loose stools or vomiting for a day. Rarely, mild fever.',
    notes: 'Oral vaccine — give the full dose by mouth. Must be completed by 32 weeks of age (the upper age limit varies by brand). Do not delay.',
  },
  fipv: {
    name: 'IPV (Inactivated Polio Vaccine)',
    protects: 'Polio — injectable form provides stronger and longer-lasting immunity than OPV alone.',
    schedule: '6 weeks and 14 weeks (fractional doses)',
    route: 'Intradermal injection, anterolateral thigh',
    commonSideEffects: 'Mild pain or redness at the injection site. Low-grade fever is rare.',
    notes: 'Fractional dose (0.5 ml) — this is normal and provides adequate protection. Given alongside Pentavalent and OPV at the same visit.',
  },
  mr: {
    name: 'Measles-Rubella (MR) Vaccine',
    protects: 'Measles and Rubella — both highly contagious viral diseases that can cause serious complications.',
    schedule: 'First dose at 9–12 months, second dose at 16–24 months',
    route: 'Subcutaneous injection, right upper arm (dose 1), left upper arm (dose 2)',
    commonSideEffects: 'Mild fever and rash 5–12 days after vaccination. This is a normal immune response, not an allergy.',
    notes: 'The measles component is critical — measles outbreaks happen when coverage drops. If a child has a fever on the day, postpone. Two doses are needed for lifelong protection.',
  },
  vita: {
    name: 'Vitamin A',
    protects: 'Vitamin A deficiency — prevents blindness, strengthens immunity, and reduces child mortality from infections.',
    schedule: 'First dose at 9–12 months, second dose at 16–24 months',
    route: 'Oral (capsule or drops)',
    commonSideEffects: 'None usually. Very high doses can cause temporary headache or nausea.',
    notes: 'Not a vaccine but part of the immunization schedule. Give the age-appropriate dose. Vitamin A is stored in the liver — doses are spaced months apart deliberately.',
  },
  dpt: {
    name: 'DPT Booster',
    protects: 'Diphtheria, Pertussis, and Tetanus — booster doses strengthen immunity as maternal antibodies fade.',
    schedule: 'First booster at 16–24 months, second booster at 5–6 years',
    route: 'Intramuscular injection, thigh',
    commonSideEffects: 'Pain or swelling at the injection site. Mild fever for 1–2 days. Fussiness for a day.',
    notes: 'Boosters are essential — without them, immunity from the infant series wanes by age 4–5. Always check the child has completed the primary series first.',
  },
  tt: {
    name: 'Tetanus Toxoid (TT)',
    protects: 'Tetanus — given to older children and mothers to prevent lockjaw, especially around childbirth.',
    schedule: 'At 10–16 years (for adolescent girls, before marriage/pregnancy)',
    route: 'Intramuscular injection, upper arm',
    commonSideEffects: 'Mild pain at the injection site. Low-grade fever is rare.',
    notes: 'For adolescent girls, this is part of the maternal tetanus protection. Two doses spaced 4 weeks apart are needed. Important for future safe childbirth.',
  },
  pcv: {
    name: 'Pneumococcal Conjugate Vaccine (PCV)',
    protects: 'Pneumococcal disease — pneumonia, meningitis, and bloodstream infections caused by Streptococcus pneumoniae.',
    schedule: '6 weeks, 14 weeks (doses 1–2), booster at 9–12 months (dose 3)',
    route: 'Intramuscular injection, anterolateral thigh',
    commonSideEffects: 'Mild pain or swelling at the injection site. Low-grade fever for 1–2 days.',
    notes: 'Pneumonia is a leading killer of Indian children under 5. PCV dramatically reduces severe pneumonia and meningitis. Complete all scheduled doses.',
  },
};

/**
 * Look up vaccine info by code. Falls back to a generic entry for unknown
 * codes rather than returning null, so the info modal always has content.
 */
export function getVaccineInfo(vaccineCode: string | null | undefined): VaccineInfo {
  if (!vaccineCode) {
    return {
      name: 'Vaccine',
      protects: 'No detailed information available for this vaccine.',
      schedule: 'As per NIP schedule',
      route: 'As per NIP schedule',
      commonSideEffects: 'Consult the immunization card or PHC for details.',
      notes: 'Refer to the National Immunization Schedule for guidance.',
    };
  }
  const key = normalize(vaccineCode);
  return (
    INFO[key] ?? {
      name: vaccineCode,
      protects: 'No detailed information available for this vaccine.',
      schedule: 'As per NIP schedule',
      route: 'As per NIP schedule',
      commonSideEffects: 'Consult the immunization card or PHC for details.',
      notes: 'Refer to the National Immunization Schedule for guidance.',
    }
  );
}
