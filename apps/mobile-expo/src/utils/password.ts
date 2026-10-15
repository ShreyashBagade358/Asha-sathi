/**
 * Patient sign-in password, generated when the ASHA saves the patient.
 *
 * Same shape as the server's `generate_patient_password` - `Pat@<last4><4
 * random>` (e.g. `Pat@3216K7m2`): the phone tail helps the worker match the
 * password to the patient, while the random suffix keeps it from being
 * guessable from the number alone. The app must generate it locally because
 * the save can happen offline; the server stores only the bcrypt hash when
 * the record syncs.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomChars(count: number): string {
  const bytes = new Uint8Array(count);
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < count; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < count; i += 1) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export function generatePatientPassword(phone: string): string {
  return `Pat@${phone.slice(-4)}${randomChars(4)}`;
}
