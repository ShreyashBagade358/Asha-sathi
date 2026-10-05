import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  tone: ToastTone
  message: string
  durationMs?: number
}

interface UIState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  toasts: Toast[]
  setSidebarOpen: (open: boolean) => void
  toggleSidebarCollapsed: () => void
  addToast: (tone: ToastTone, message: string, durationMs?: number) => void
}

let toastSeq = 0

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  toasts: [],

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  addToast: (tone, message, durationMs = 3500) => {
    const id = `toast-${++toastSeq}-${Date.now()}`
    set((s) => ({ toasts: [...s.toasts, { id, tone, message, durationMs }] }))
    if (durationMs > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, durationMs)
    }
  },
}))
