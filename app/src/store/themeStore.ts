import { create } from 'zustand'

export type ThemeId = 'aurora' | 'editorial'

export interface ThemeMeta {
  id: ThemeId
  name: string
  note: string
  /** false = visible in the picker but not yet implemented */
  available: boolean
  /** small gradient/colour preview for the settings swatch */
  preview: string
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'aurora',
    name: 'Aurora Glass',
    note: '메시 그라데이션 · 글래스',
    available: true,
    preview:
      'radial-gradient(60% 80% at 20% 20%, #d9c8ff, transparent 60%), radial-gradient(60% 80% at 90% 30%, #b8f0e6, transparent 60%), linear-gradient(135deg,#eef1fb,#f4f0fc)',
  },
  {
    id: 'editorial',
    name: 'Editorial Bold',
    note: '미색 · 큰 타이포 · 포인트 1색',
    available: true,
    preview: 'linear-gradient(135deg,#f4f2ec 0%,#f4f2ec 62%,#ff4d2e 62%,#ff4d2e 100%)',
  },
]

const STORAGE_KEY = 'ec-theme'

const readInitial = (): ThemeId => {
  if (typeof window === 'undefined') return 'aurora'
  const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null
  const meta = THEMES.find((t) => t.id === saved)
  return meta && meta.available ? meta.id : 'aurora'
}

/** Apply the theme to <html data-theme> so CSS tokens swap. */
export const applyTheme = (id: ThemeId) => {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = id
}

interface ThemeState {
  theme: ThemeId
  setTheme: (id: ThemeId) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readInitial(),
  setTheme: (id) => {
    const meta = THEMES.find((t) => t.id === id)
    if (!meta || !meta.available) return
    applyTheme(id)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, id)
    set({ theme: id })
  },
}))

// apply persisted theme immediately on module load (before first paint)
applyTheme(readInitial())
