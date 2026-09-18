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

export const configService = {
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
