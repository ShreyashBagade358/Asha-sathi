import { api } from '@/lib/api'

export type ResourceType = 'staff' | 'vaccines' | 'equipment' | 'medicines' | 'vehicles'

export interface ResourceAllocation {
  id: string
  phcId: string
  phcName: string
  resourceType: ResourceType
  quantity: number
  notes: string | null
  districtId: string | null
  createdAt: string
}

interface RawAllocation {
  id: string
  phc_id: string
  phc_name: string
  resource_type: ResourceType
  quantity: number
  notes: string | null
  district_id: string | null
  created_at: string
}

const mapAllocation = (r: RawAllocation): ResourceAllocation => ({
  id: r.id,
  phcId: r.phc_id,
  phcName: r.phc_name,
  resourceType: r.resource_type,
  quantity: r.quantity,
  notes: r.notes,
  districtId: r.district_id,
  createdAt: r.created_at,
})

export const resourceService = {
  async createAllocation(payload: {
    phcId: string
    resourceType: ResourceType
    quantity: number
    notes?: string
    districtId?: string
  }): Promise<ResourceAllocation> {
    const { data } = await api.post<RawAllocation>('/resources/allocations', {
      phc_id: payload.phcId,
      resource_type: payload.resourceType,
      quantity: payload.quantity,
      notes: payload.notes || null,
      district_id: payload.districtId || undefined,
    })
    return mapAllocation(data)
  },

  async listAllocations(params: { districtId?: string; limit?: number } = {}): Promise<ResourceAllocation[]> {
    const { data } = await api.get<RawAllocation[]>('/resources/allocations', {
      params: { district_id: params.districtId, limit: params.limit ?? 20 },
    })
    return data.map(mapAllocation)
  },
}
