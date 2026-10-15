import { Share } from 'react-native';

/**
 * The app's export path: hand a rendered plain-text payload to the OS share
 * sheet. It runs offline, needs no extra dependency, and — unlike a toast that
 * only claims a download happened — leaves the user actually holding the data
 * (WhatsApp, mail, files, print, whatever the device offers).
 *
 * Callers build the whole message themselves so this stays i18n-agnostic, and
 * the title doubles as the sheet's heading. Returns false when nothing left
 * the sheet (dismissed or unavailable) so a caller can stay quiet instead of
 * reporting a success that never happened.
 */
export async function shareText(title: string, message: string): Promise<boolean> {
  try {
    const result = await Share.share({ message, title }, { dialogTitle: title });
    return result.action === 'sharedAction';
  } catch {
    return false;
  }
}
