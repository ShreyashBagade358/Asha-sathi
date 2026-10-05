export const OTP_LENGTH = 6;

export const OTP_RESEND_SECONDS = 45;

/** Fixed-length box state: one entry per box, '' while empty. */
export type OtpDigits = readonly string[];

export type OtpEdit = { digits: OtpDigits; index: number };

export function createOtpDigits(): OtpDigits {
  return Array.from({ length: OTP_LENGTH }, () => '');
}

export function otpCode(digits: OtpDigits): string {
  return digits.join('');
}

export function isOtpComplete(digits: OtpDigits): boolean {
  return digits.length === OTP_LENGTH && digits.every((d) => d.length === 1);
}

const clampIndex = (index: number) => Math.max(0, Math.min(index, OTP_LENGTH - 1));

/**
 * Writes the accepted characters into the boxes starting at `index` and
 * returns where focus should land: one box past the last written digit, so a
 * single keystroke auto-advances and a 6-digit paste fills every box in one go.
 */
function fill(digits: OtpDigits, index: number, text: string): OtpEdit {
  const start = clampIndex(index);
  const clean = text.replace(/\D/g, '').slice(0, OTP_LENGTH - start);
  if (clean.length === 0) return { digits, index: start };

  const next = [...digits];
  for (let i = 0; i < clean.length; i += 1) {
    next[start + i] = clean[i] as string;
  }
  return { digits: next, index: Math.min(start + clean.length, OTP_LENGTH - 1) };
}

/**
 * One box's `onChangeText` value, which is the box's whole new content:
 * a paste arrives as several characters, a keystroke into a filled box as the
 * old value plus the new one, and a deletion as an empty string.
 */
export function applyOtpInput(digits: OtpDigits, index: number, text: string): OtpEdit {
  const at = clampIndex(index);
  const clean = text.replace(/\D/g, '');
  const previous = digits[at] ?? '';

  if (clean.length === 0) {
    const next = [...digits];
    next[at] = '';
    return { digits: next, index: at };
  }
  if (clean === previous) return { digits, index: at };

  // Typing over a filled box keeps the old digit as a prefix ("4" + "5" -> "45"):
  // only the appended character is a real keystroke.
  if (previous.length > 0 && clean.startsWith(previous) && clean.length === previous.length + 1) {
    return fill(digits, at, clean.slice(-1));
  }

  return fill(digits, at, clean);
}

/**
 * A `Backspace` key press. With content in the box the deletion itself arrives
 * through `applyOtpInput`; this branch only runs on an empty box, where the
 * mock walks focus one box back and clears it so the digit can be retyped.
 */
export function applyOtpBackspace(digits: OtpDigits, index: number): OtpEdit {
  const at = clampIndex(index);
  if (at === 0) return { digits, index: at };

  const next = [...digits];
  const target = at - 1;
  next[target] = '';
  return { digits: next, index: target };
}

/** Paste handler: fills from the focused box, ignoring anything non-numeric. */
export function applyOtpPaste(digits: OtpDigits, index: number, text: string): OtpEdit {
  return fill(digits, index, text);
}

/** 00:45 → "00:07". */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** +91 ******890 — the mock keeps the last three digits only. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 3) return `+91 ${'*'.repeat(6)}${digits}`;
  return `+91 ${'*'.repeat(6)}${digits.slice(-3)}`;
}

/**
 * The dev backend returns "OTP sent to … (dev otp: 001234) …" because no SMS
 * provider is configured. Surfacing that code is the only way to complete the
 * flow on a dev box; production responses never contain it, so this yields null.
 */
export function extractDevOtp(message: string): string | null {
  const match = /dev otp:\s*(\d{4,8})/i.exec(message);
  return match?.[1] ?? null;
}
