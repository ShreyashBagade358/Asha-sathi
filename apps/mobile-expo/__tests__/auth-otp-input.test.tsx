import {
  applyOtpBackspace,
  applyOtpInput,
  applyOtpPaste,
  createOtpDigits,
  extractDevOtp,
  formatCountdown,
  isOtpComplete,
  maskPhone,
  otpCode,
  OTP_LENGTH,
} from '../src/auth/otp';

/**
 * The six OTP boxes are driven by pure reducers rather than per-box DOM
 * behaviour, so the interesting cases (auto-advance, backspace walking back,
 * pasting a whole code) are testable without mounting a screen.
 */

const filled = (...digits: string[]) => [...digits, ...Array(OTP_LENGTH - digits.length).fill('')];

describe('typing into a box', () => {
  it('stores the digit and advances focus to the next box', () => {
    const result = applyOtpInput(createOtpDigits(), 0, '4');
    expect(result.digits).toEqual(filled('4'));
    expect(result.index).toBe(1);
  });

  it('keeps focus on the last box so a 6th digit cannot run past the end', () => {
    const result = applyOtpInput(filled('1', '2', '3', '4', '5'), 5, '6');
    expect(result.digits).toEqual(filled('1', '2', '3', '4', '5', '6'));
    expect(result.index).toBe(OTP_LENGTH - 1);
    expect(isOtpComplete(result.digits)).toBe(true);
    expect(otpCode(result.digits)).toBe('123456');
  });

  it('ignores non-numeric characters', () => {
    const result = applyOtpInput(createOtpDigits(), 0, 'a');
    expect(result.digits).toEqual(createOtpDigits());
    expect(result.index).toBe(0);
  });

  it('clears the box when the field empties, without moving focus', () => {
    const result = applyOtpInput(filled('1', '2'), 1, '');
    expect(result.digits).toEqual(filled('1'));
    expect(result.index).toBe(1);
  });

  it('treats a keystroke over a filled box as a replacement, not a paste', () => {
    // Android/iOS report the field's whole content, so "4" + "5" arrives as
    // "45". Only the appended digit is the keystroke.
    const result = applyOtpInput(filled('4'), 0, '45');
    expect(result.digits).toEqual(filled('5'));
    expect(result.index).toBe(1);
  });

  it('leaves an unchanged field alone', () => {
    const digits = filled('4');
    expect(applyOtpInput(digits, 0, '4')).toEqual({ digits, index: 0 });
  });
});

describe('backspace', () => {
  it('walks focus back and clears the previous box when the box is empty', () => {
    const result = applyOtpBackspace(filled('1', '2'), 2);
    expect(result.digits).toEqual(filled('1'));
    expect(result.index).toBe(1);
  });

  it('does not walk back from the first box', () => {
    const digits = filled('1');
    expect(applyOtpBackspace(digits, 0)).toEqual({ digits, index: 0 });
  });
});

describe('paste', () => {
  it('fills every box from a full 6-digit paste in one shot', () => {
    const result = applyOtpPaste(createOtpDigits(), 0, '987654');
    expect(result.digits).toEqual(filled('9', '8', '7', '6', '5', '4'));
    expect(result.index).toBe(OTP_LENGTH - 1);
    expect(otpCode(result.digits)).toBe('987654');
  });

  it('strips spaces, dashes and letters from the pasted text', () => {
    const result = applyOtpPaste(createOtpDigits(), 0, ' 98-76 5 ');
    expect(otpCode(result.digits)).toBe('98765');
  });

  it('fills from the focused box rather than from the start', () => {
    const result = applyOtpPaste(filled('1', '2'), 2, '345678');
    expect(otpCode(result.digits)).toBe('123456');
    expect(result.index).toBe(OTP_LENGTH - 1);
  });

  it('never writes past the sixth box', () => {
    const result = applyOtpPaste(createOtpDigits(), 4, '123456');
    expect(otpCode(result.digits)).toBe('12');
    expect(result.digits.slice(0, 4)).toEqual(['', '', '', '']);
    expect(result.index).toBe(OTP_LENGTH - 1);
  });

  it('routes a multi-character field value through the paste path', () => {
    // A paste arrives through onChangeText, so applyOtpInput must not treat
    // "123456" as six separate keystrokes that stop at the first box.
    const result = applyOtpInput(createOtpDigits(), 0, '123456');
    expect(otpCode(result.digits)).toBe('123456');
    expect(result.index).toBe(OTP_LENGTH - 1);
  });
});

describe('display helpers', () => {
  it('formats the resend countdown as mm:ss', () => {
    expect(formatCountdown(45)).toBe('00:45');
    expect(formatCountdown(7)).toBe('00:07');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-3)).toBe('00:00');
  });

  it('masks the phone to the last three digits, as the mock does', () => {
    expect(maskPhone('9876543210')).toBe('+91 ******210');
    expect(maskPhone('8010159779')).toBe('+91 ******779');
  });

  it('reads the dev OTP out of the send response message', () => {
    expect(
      extractDevOtp('OTP sent to 9876543210 (dev otp: 001234). Login bypass (OTP 1234): 9876543210->asha'),
    ).toBe('001234');
    expect(extractDevOtp('OTP sent to 9876543210')).toBeNull();
  });
});
