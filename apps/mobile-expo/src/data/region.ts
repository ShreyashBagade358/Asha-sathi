import { useEffect, useState } from 'react';

import { apiRequest } from '@/auth/api';
import { metadata } from '@/db/database';
import { subscribeOnline } from '@/sync/network';

import {
  REGION_SEED,
  type RegionSeedDistrict,
  type RegionSeedVillage,
} from './region-seed';

/** A geography row as the forms need it: id plus display name. */
export interface RegionPlace {
  id: string;
  name: string;
}

export interface RegionDistrict extends RegionPlace {
  /** Present on rows from the server / seed; lets the form cascade by state. */
  state_id?: string | null;
}

export interface RegionVillage extends RegionPlace {
  /** Present on rows from the server / seed; lets the form cascade by district. */
  district_id?: string | null;
}

/**
 * The signed-in worker's own geography, from `GET /config/my-region`.
 * `state` / `district` / `phc` are null for roles with no assignment;
 * `villages` is the set the worker may register people and homes against
 * (an ASHA's catchment villages, otherwise her PHC's villages).
 *
 * This is the *assignment* - who the worker is. The *options* the selects
 * show come from the bundled REGION_SEED merged with this, via the
 * statesFor / districtsFor / villagesFor helpers below, so the forms work
 * before the first fetch and in airplane mode.
 */
export interface MyRegion {
  state: RegionPlace | null;
  district: RegionDistrict | null;
  phc: RegionPlace | null;
  villages: RegionVillage[];
}

export const EMPTY_REGION: MyRegion = { state: null, district: null, phc: null, villages: [] };

const CACHE_KEY = 'my_region';

/** The copy written at the last successful fetch, or null when never fetched. */
export async function readRegionCache(): Promise<MyRegion | null> {
  const raw = await metadata.get(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MyRegion>;
    return {
      state: parsed.state ?? null,
      district: parsed.district ?? null,
      phc: parsed.phc ?? null,
      villages: Array.isArray(parsed.villages) ? parsed.villages : [],
    };
  } catch {
    return null;
  }
}

/** Fetch the region and refresh the offline cache. */
export async function fetchMyRegion(): Promise<MyRegion> {
  const region = await apiRequest<MyRegion>('/config/my-region');
  await metadata.set(CACHE_KEY, JSON.stringify(region));
  return region;
}

/**
 * Region for a form: always attempt the server copy first (the cache is
 * refreshed on success) and fall back to the last cached copy when there is
 * no signal. The fetch is deliberately not gated on NetInfo - a stale
 * "offline" flag must never be the reason the cache stays empty.
 */
export async function loadMyRegion(): Promise<MyRegion> {
  try {
    return await fetchMyRegion();
  } catch {
    return (await readRegionCache()) ?? EMPTY_REGION;
  }
}

// --- Select options: bundled seed merged with the worker's assignment -----

/** Every state the form can offer - the bundled seed, assignment included. */
export function statesFor(region: MyRegion): RegionPlace[] {
  const list: RegionPlace[] = REGION_SEED.states.map(({ id, name }) => ({ id, name }));
  const own = region.state;
  if (own && !list.some((state) => state.id === own.id)) list.unshift(own);
  return list;
}

/** Districts of one state; empty list until a state is chosen. */
export function districtsFor(region: MyRegion, stateId: string): RegionDistrict[] {
  if (!stateId) return [];
  const list: RegionDistrict[] = REGION_SEED.districts
    .filter((district) => district.state_id === stateId)
    .map(({ id, name, state_id }) => ({ id, name, state_id }));
  const own = region.district;
  if (own && (own.state_id === stateId || !own.state_id) && !list.some((d) => d.id === own.id)) {
    list.unshift(own);
  }
  return list;
}

/** Villages of one district, plus the worker's own when their district is unknown. */
export function villagesFor(region: MyRegion, districtId: string): RegionVillage[] {
  const list: RegionVillage[] = [];
  if (districtId) {
    for (const village of REGION_SEED.villages) {
      if (village.district_id === districtId) {
        list.push({ id: village.id, name: village.name, district_id: village.district_id });
      }
    }
  }
  for (const village of region.villages) {
    const known = Boolean(village.district_id);
    if (districtId && known && village.district_id !== districtId) continue;
    if (!list.some((entry) => entry.id === village.id)) list.push(village);
  }
  return list;
}

/** All villages the form can offer when there is no district to filter by. */
export function allVillagesFor(region: MyRegion): RegionVillage[] {
  const list: RegionVillage[] = REGION_SEED.villages.map(({ id, name, district_id }) => ({
    id,
    name,
    district_id,
  }));
  for (const village of region.villages) {
    if (!list.some((entry) => entry.id === village.id)) list.push(village);
  }
  return list;
}

export interface MyRegionState {
  region: MyRegion;
  /** True until the first load settles - the forms use it to avoid flashing the offline hint. */
  loading: boolean;
}

/**
 * Live region for a screen: loads once on mount (cache if offline, server if
 * online), then refreshes whenever connectivity appears while the form is
 * open, so a form opened in a dead zone fills itself the moment a signal
 * returns. Selections are the caller's state - this only owns the region.
 */
export function useMyRegion(): MyRegionState {
  const [region, setRegion] = useState<MyRegion>(EMPTY_REGION);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const refresh = () => {
      void loadMyRegion().then((next) => {
        if (!active) return;
        setRegion(next);
        setLoading(false);
      });
    };

    refresh();
    let firstEvent = true;
    const unsubscribe = subscribeOnline((online) => {
      // The immediate echo only reports the state the load above already saw;
      // real offline -> online edges are what need a retry.
      if (firstEvent) {
        firstEvent = false;
        return;
      }
      if (online) refresh();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { region, loading };
}
