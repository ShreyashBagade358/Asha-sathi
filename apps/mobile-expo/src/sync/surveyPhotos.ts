import AsyncStorage from '@react-native-async-storage/async-storage';

import { tokenStore } from '@/auth/tokenStore';
import { config } from '@/config';
import { getDatabase } from '@/db/database';

/**
 * Offline-first survey photo upload.
 *
 * Survey photos (both household-level and per-member check photos) are queued
 * locally and uploaded after the survey/check rows have been pushed to the
 * server. This is called from the sync engine after a successful push+pull.
 */

interface PendingSurveyPhoto {
  surveyId: string;
  photoKey: string;
  uri: string;
}

interface PendingMemberCheckPhoto {
  checkId: string;
  uri: string;
}

const SURVEY_PHOTOS_KEY = 'pending_survey_photos';
const CHECK_PHOTOS_KEY = 'pending_check_photos';

async function readSurveyPhotos(): Promise<Record<string, PendingSurveyPhoto[]>> {
  try {
    const raw = await AsyncStorage.getItem(SURVEY_PHOTOS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, PendingSurveyPhoto[]>) : {};
  } catch {
    return {};
  }
}

async function writeSurveyPhotos(map: Record<string, PendingSurveyPhoto[]>): Promise<void> {
  const hasData = Object.values(map).some(arr => arr.length > 0);
  if (!hasData) await AsyncStorage.removeItem(SURVEY_PHOTOS_KEY);
  else await AsyncStorage.setItem(SURVEY_PHOTOS_KEY, JSON.stringify(map));
}

async function readCheckPhotos(): Promise<Record<string, PendingMemberCheckPhoto[]>> {
  try {
    const raw = await AsyncStorage.getItem(CHECK_PHOTOS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, PendingMemberCheckPhoto[]>) : {};
  } catch {
    return {};
  }
}

async function writeCheckPhotos(map: Record<string, PendingMemberCheckPhoto[]>): Promise<void> {
  const hasData = Object.values(map).some(arr => arr.length > 0);
  if (!hasData) await AsyncStorage.removeItem(CHECK_PHOTOS_KEY);
  else await AsyncStorage.setItem(CHECK_PHOTOS_KEY, JSON.stringify(map));
}

export async function queueSurveyPhotos(surveyId: string, photos: { photoKey: string; uri: string }[]): Promise<void> {
  const map = await readSurveyPhotos();
  if (!map[surveyId]) map[surveyId] = [];
  map[surveyId].push(...photos.map(p => ({ surveyId, ...p })));
  await writeSurveyPhotos(map);
}

export async function queueMemberCheckPhotos(checkId: string, photos: { uri: string }[]): Promise<void> {
  const map = await readCheckPhotos();
  if (!map[checkId]) map[checkId] = [];
  map[checkId].push(...photos.map(p => ({ checkId, ...p })));
  await writeCheckPhotos(map);
}

/**
 * Upload all queued survey photos. Returns number uploaded.
 */
export async function flushPendingSurveyPhotos(): Promise<number> {
  const map = await readSurveyPhotos();
  const surveyIds = Object.keys(map);
  if (surveyIds.length === 0) return 0;

  const token = await tokenStore.getAccessToken();
  if (!token) return 0;

  let uploaded = 0;

  for (const surveyId of surveyIds) {
    const photos = map[surveyId] ?? [];
    for (const photo of photos) {
      let keep = false;
      try {
        const form = new FormData();
        form.append('file', { uri: photo.uri, name: `${surveyId}-${photo.photoKey}.jpg`, type: 'image/jpeg' } as unknown as Blob);

        const response = await fetch(`${config.apiBase}/households/${photo.surveyId}/survey/${surveyId}/photo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });

        if (response.ok) {
          // Successfully uploaded - could update local photo_urls if needed
          uploaded += 1;
        } else if (response.status === 404 || response.status === 401 || response.status >= 500) {
          keep = true;
        } else {
          // Rejected payload - drop it
        }
      } catch {
        keep = true;
      }
      if (keep) break;
    }
  }

  // Remove uploaded photos from queue
  for (const surveyId of surveyIds) {
    const photos = map[surveyId] ?? [];
    map[surveyId] = photos.filter((_, idx) => idx >= uploaded);
    if (map[surveyId].length === 0) delete map[surveyId];
  }
  await writeSurveyPhotos(map);

  return uploaded;
}

/**
 * Upload all queued member check photos. Returns number uploaded.
 */
export async function flushPendingMemberCheckPhotos(): Promise<number> {
  const map = await readCheckPhotos();
  const checkIds = Object.keys(map);
  if (checkIds.length === 0) return 0;

  const token = await tokenStore.getAccessToken();
  if (!token) return 0;

  const db = await getDatabase();
  let uploaded = 0;

  for (const checkId of checkIds) {
    const photos = map[checkId] ?? [];
    for (const photo of photos) {
      let keep = false;
      try {
        const form = new FormData();
        form.append('file', { uri: photo.uri, name: `${checkId}.jpg`, type: 'image/jpeg' } as unknown as Blob);

        const response = await fetch(`${config.apiBase}/households/survey/check/${checkId}/photo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });

        if (response.ok) {
          const payload = (await response.json().catch(() => null)) as { photo_url?: string } | null;
          if (payload?.photo_url) {
            await db.runAsync('UPDATE household_visit_checks SET photo_url = ? WHERE id = ?', JSON.stringify([payload.photo_url]), checkId);
          }
          uploaded += 1;
        } else if (response.status === 404 || response.status === 401 || response.status >= 500) {
          keep = true;
        } else {
          // Rejected payload - drop it
        }
      } catch {
        keep = true;
      }
      if (keep) break;
    }
  }

  // Remove uploaded photos from queue
  for (const checkId of checkIds) {
    const photos = map[checkId] ?? [];
    map[checkId] = photos.filter((_, idx) => idx >= uploaded);
    if (map[checkId].length === 0) delete map[checkId];
  }
  await writeCheckPhotos(map);

  return uploaded;
}