import { api } from '@/lib/api'
import type { Notification, Paginated } from '@/types'

export interface NotificationListParams {
  status?: 'unread' | 'read' | 'all'
  page?: number
  pageSize?: number
}

export interface CreateNotificationPayload {
  title: string
  message: string
  type?: string
  priority?: string
  actionUrl?: string
}

interface RawNotification {
  id: string
  user_id: string
  type?: string
  title: string
  message: string
  status?: string
  created_at?: string
}

function mapNotification(r: RawNotification): Notification {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type === 'sync' ? 'sync' : r.type === 'system' ? 'system' : r.type === 'incentive' ? 'incentive' : 'alert',
    title: r.title,
    message: r.message,
    read: (r.status ?? 'unread') === 'read',
    createdAt: r.created_at ?? '',
  }
}

function mapPaginated<T>(raw: { items: T[]; total: number; page: number; page_size: number; total_pages: number }): Paginated<T> {
  return {
    items: raw.items,
    total: raw.total,
    page: raw.page,
    pageSize: raw.page_size,
    totalPages: raw.total_pages,
  }
}

export const notificationService = {
  async listNotifications(params: NotificationListParams = {}): Promise<Paginated<Notification>> {
    const { data } = await api.get<{ items: RawNotification[]; total: number; page: number; page_size: number; total_pages: number }>('/notifications', {
      params: {
        status: params.status === 'all' ? undefined : params.status,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 20,
      },
    })
    return mapPaginated({ ...data, items: data.items.map(mapNotification) })
  },

  async createNotification(payload: CreateNotificationPayload): Promise<Notification> {
    const { data } = await api.post<RawNotification>('/notifications', payload)
    return mapNotification(data)
  },

  async markRead(id: string): Promise<Notification> {
    const { data } = await api.put<RawNotification>(`/notifications/${id}/read`)
    return mapNotification(data)
  },
}
