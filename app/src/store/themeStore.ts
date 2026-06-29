import { create } from 'zustand'

export type ThemeId =
  | 'aurora'
  | 'editorial'
  | 'noir'
  | 'cyber'
  | 'sunset'
  | 'forest'
  | 'rose'
  | 'ocean'
  | 'midnight'
  | 'luxe'

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
  {
    id: 'noir',
    name: 'Noir',
    note: '깔끔한 블랙 · 미니멀',
    available: true,
    preview: 'radial-gradient(60% 60% at 25% 20%, #1c1c20, transparent 60%), linear-gradient(135deg,#0c0c0f,#09090c)',
  },
  {
    id: 'cyber',
    name: 'Cyber',
    note: '미래지향 가상공간 · 기계적',
    available: true,
    preview: 'linear-gradient(rgba(0,229,255,.5) 1px,transparent 1px) 0 0/10px 10px, linear-gradient(90deg,rgba(0,229,255,.5) 1px,transparent 1px) 0 0/10px 10px, linear-gradient(135deg,#05080f 0%,#0a1a2e 60%,#00e5ff 130%)',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    note: '따뜻한 코랄 · 골드',
    available: true,
    preview: 'linear-gradient(135deg,#ffd6bf,#ff9ec0 60%,#ffb04a)',
  },
  {
    id: 'forest',
    name: 'Forest',
    note: '자연 · 세이지 그린',
    available: true,
    preview: 'linear-gradient(135deg,#cfe8cf,#7cb342 60%,#3aa6a0)',
  },
  {
    id: 'rose',
    name: 'Rose',
    note: '벚꽃 · 파스텔 핑크',
    available: true,
    preview: 'linear-gradient(135deg,#ffd0e0,#e6b3ff 60%,#ff5e8a)',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    note: '마린 · 딥 블루',
    available: true,
    preview: 'linear-gradient(135deg,#bfe0ff,#22b6c8 60%,#0a84ff)',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    note: '인디고 · 퍼플 다크',
    available: true,
    preview: 'radial-gradient(60% 60% at 25% 20%,#2a1c46,transparent 60%), linear-gradient(135deg,#0e0b1a,#7a5cff)',
  },
  {
    id: 'luxe',
    name: 'Luxe',
    note: '차콜 · 골드 럭셔리',
    available: true,
    preview: 'linear-gradient(135deg,#14110c,#1d1a12 55%,#e8c878)',
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
