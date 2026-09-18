import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  tone: ToastTone
  message: string
  durationMs?: number
}

export interface ActiveFilter {
  village?: string
  status?: string
  period?: string
  ashaId?: string
}

interface UIState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  activeFilter: ActiveFilter
  toasts: Toast[]
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  toggleSidebarCollapsed: () => void
  setActiveFilter: (filter: Partial<ActiveFilter>) => void
  clearFilters: () => void
  addToast: (tone: ToastTone, message: string, durationMs?: number) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

let toastSeq = 0

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  activeFilter: {},
  toasts: [],

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setActiveFilter: (filter) =>
    set((s) => ({ activeFilter: { ...s.activeFilter, ...filter } })),
  clearFilters: () => set({ activeFilter: {} }),

  addToast: (tone, message, durationMs = 3500) => {
    const id = `toast-${++toastSeq}-${Date.now()}`
    set((s) => ({ toasts: [...s.toasts, { id, tone, message, durationMs }] }))
    if (durationMs > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, durationMs)
    }
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}))
