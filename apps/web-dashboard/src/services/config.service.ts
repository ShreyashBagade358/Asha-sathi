import { api } from '@/lib/api'

export interface GeoEntry {
  id: string
  code?: string
  name: string
}

export interface VillageEntry extends GeoEntry {
  totalHouseholds?: number
  totalPopulation?: number
}

const mapEntry = (r: { id: string; code?: string; name: string }): GeoEntry => ({
  id: r.id,
  code: r.code,
  name: r.name,
})

export interface AppConfigEntry {
  key: string
  value: unknown
  scope: string
  isPublic: boolean
  version: number
}

export const configService = {
  async getFullAppConfig(): Promise<AppConfigEntry[]> {
    const { data } = await api.get<{ items: Array<{ config_key: string; config_value: unknown; scope: string; is_public: boolean; version: number }> }>('/config/app/full')
    return data.items.map((i) => ({ key: i.config_key, value: i.config_value, scope: i.scope, isPublic: i.is_public, version: i.version }))
  },

  async putAppConfig(configs: Array<{ key: string; value: unknown; description?: string; isPublic?: boolean }>): Promise<{ updated: number }> {
    const { data } = await api.put<{ updated: number }>('/config/app', {
      configs: configs.map((c) => ({ config_key: c.key, config_value: c.value, description: c.description, is_public: c.isPublic })),
    })
    return data
  },

  async getStates(): Promise<GeoEntry[]> {
    const { data } = await api.get<Array<{ id: string; code: string; name: string }>>('/config/states')
    return data.map(mapEntry)
  },

  async getDistricts(stateId: string): Promise<GeoEntry[]> {
    const { data } = await api.get<Array<{ id: string; code: string; name: string }>>(`/config/states/${stateId}/districts`)
    return data.map(mapEntry)
  },

  async getBlocks(districtId: string): Promise<GeoEntry[]> {
    const { data } = await api.get<Array<{ id: string; code: string; name: string }>>(`/config/districts/${districtId}/blocks`)
    return data.map(mapEntry)
  },

  async getPHCs(blockId: string): Promise<GeoEntry[]> {
    const { data } = await api.get<Array<{ id: string; code: string; name: string }>>(`/config/blocks/${blockId}/phcs`)
    return data.map(mapEntry)
  },

  async getVillages(phcId: string): Promise<VillageEntry[]> {
    const { data } = await api.get<Array<{ id: string; code: string; name: string; total_households?: number; total_population?: number }>>(`/config/phc/${phcId}/villages`)
    return data.map((v) => ({ ...mapEntry(v), totalHouseholds: v.total_households, totalPopulation: v.total_population }))
  },

  async getPHC(phcId: string): Promise<Record<string, unknown>> {
    const { data } = await api.get(`/config/phc/${phcId}`)
    return data
  },

  /** The signed-in worker's geography in one call — state / district / PHC
   *  plus catchment villages flattened with `districtId` so a form can
   *  cascade state -> district -> village like the mobile app does. */
  async getMyRegion(): Promise<{
    state: GeoEntry | null
    district: GeoEntry | null
    phc: GeoEntry | null
    villages: Array<VillageEntry & { districtId?: string }>
  }> {
    const { data } = await api.get<{
      state: { id: string; code: string; name: string } | null
      district: { id: string; code: string; name: string } | null
      phc: { id: string; code?: string; name: string } | null
      villages: Array<{ id: string; code: string; name: string; district_id?: string }>
    }>('/config/my-region')
    return {
      state: data.state ? mapEntry(data.state) : null,
      district: data.district ? mapEntry(data.district) : null,
      phc: data.phc ? mapEntry({ id: data.phc.id, code: data.phc.code ?? '', name: data.phc.name }) : null,
      villages: (data.villages ?? []).map((v) => ({ ...mapEntry(v), districtId: v.district_id })),
    }
  },

  async createVillage(
    phcId: string,
    payload: { name: string; code?: string; subCenterId?: string; totalHouseholds?: number; totalPopulation?: number },
  ): Promise<VillageEntry> {
    const { data } = await api.post<{ id: string; code?: string; name: string; total_households?: number; total_population?: number }>(`/config/phc/${phcId}/villages`, {
      name: payload.name,
      code: payload.code,
      sub_center_id: payload.subCenterId,
      total_households: payload.totalHouseholds,
      total_population: payload.totalPopulation,
    })
    return { ...mapEntry(data), totalHouseholds: data.total_households, totalPopulation: data.total_population }
  },
}
