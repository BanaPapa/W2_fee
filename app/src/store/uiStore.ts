import { create } from 'zustand'

export type ModalId = 'period' | 'target' | 'trend' | 'settings' | null

interface UIState {
  modal: ModalId
  openModal: (m: Exclude<ModalId, null>) => void
  closeModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  modal: null,
  openModal: (m) => set({ modal: m }),
  closeModal: () => set({ modal: null }),
}))
