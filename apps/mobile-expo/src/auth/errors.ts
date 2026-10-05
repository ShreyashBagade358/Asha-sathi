import { ApiError } from './api';
import type { useLocalization } from '../i18n/useLocalization';

type Translate = ReturnType<typeof useLocalization>['t'];

/**
 * Turns an auth failure into user-facing copy.
 *
 * The backend speaks English and deliberately generic copy for the credential
 * failure, so every status the auth endpoints actually return maps to an i18n
 * key here; only an unrecognised server message falls through verbatim.
 */
export function authErrorMessage(error: unknown, t: Translate, unauthorized?: string): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return t('errors.network.message');
    if (error.status === 401) return unauthorized ?? t('common.invalidCredentials');
    if (error.status === 404) return t('auth.unknownPhone');
    if (error.status === 503) return t('auth.otpDeliveryFailed');
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return t('common.requestOtpFailed');
}
