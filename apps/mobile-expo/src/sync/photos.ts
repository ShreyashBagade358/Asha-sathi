import AsyncStorage from '@react-native-async-storage/async-storage';

import { tokenStore } from '@/auth/tokenStore';
import { config } from '@/config';
import { getDatabase } from '@/db/database';

/**
 * Offline-first profile-photo upload.
 *
 * The photo endpoint needs the beneficiary row to exist on the server, so a
 * picked image is parked here (local file URI + beneficiary id) and only
 * uploaded after a sync push has created the row — called from the sync
 * engine, which means an offline registration uploads on the first sync after
 * reconnection. The returned URL lands in beneficiaries.photo_url so the
 * patient page can show it.
 */
const KEY = 'pending_photos';

type PendingPhotos = Record<string, string>;

async function readAll(): Promise<PendingPhotos> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as PendingPhotos) : {};
  } catch {
    return {};
  }
}

async function writeAll(map: PendingPhotos): Promise<void> {
  if (Object.keys(map).length === 0) await AsyncStorage.removeItem(KEY);
  else await AsyncStorage.setItem(KEY, JSON.stringify(map));
}

export async function queuePendingPhoto(beneficiaryId: string, uri: string): Promise<void> {
  const map = await readAll();
  map[beneficiaryId] = uri;
  await writeAll(map);
}

/**
 * Upload every queued photo. Stops at the first photo that should stay queued
 * (server row not pushed yet, session expired, network gone) and returns the
 * number uploaded. Never throws: a failed upload must not fail a sync.
 */
export async function flushPendingPhotos(): Promise<number> {
  const map = await readAll();
  const ids = Object.keys(map);
  if (ids.length === 0) return 0;

  const token = await tokenStore.getAccessToken();
  if (!token) return 0;

  const db = await getDatabase();
  let uploaded = 0;

  for (const id of ids) {
    const uri = map[id];
    let keep = false;
    try {
      const form = new FormData();
      form.append('file', { uri, name: `${id}.jpg`, type: 'image/jpeg' } as unknown as Blob);

      const response = await fetch(`${config.apiBase}/beneficiaries/${id}/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (response.ok) {
        const payload = (await response.json().catch(() => null)) as { photo_url?: string } | null;
        if (payload?.photo_url) {
          await db.runAsync('UPDATE beneficiaries SET photo_url = ? WHERE id = ?', payload.photo_url, id);
        }
        delete map[id];
        uploaded += 1;
      } else if (response.status === 404 || response.status === 401 || response.status >= 500) {
        // Row not pushed yet / token expired / server hiccup — retry next sync.
        keep = true;
      } else {
        // Rejected payload (e.g. image too large): drop it rather than loop.
        delete map[id];
      }
    } catch {
      keep = true; // network gone mid-upload
    }
    if (keep) break;
  }

  await writeAll(map);
  return uploaded;
}
