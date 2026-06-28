import type { SVGProps } from 'react'

type IP = SVGProps<SVGSVGElement>
const base = (p: IP) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

/* ---------- category emblems (from index.html) ---------- */
export const LaborIcon = (p: IP) => (
  <svg {...base(p)}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="9.5" cy="7" r="3.5" />
    <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.2a3.5 3.5 0 0 1 0 6.8" />
  </svg>
)
export const MealIcon = (p: IP) => (
  <svg {...base(p)}>
    <path d="M6 3v8M9 3v8M6 11h3v10H6zM7.5 3v8" />
    <path d="M17 3c-1.7 0-3 1.8-3 4.5S15.3 12 17 12v9" />
  </svg>
)
export const AdIcon = (p: IP) => (
  <svg {...base(p)}>
    <path d="m3 11 16-5v12L3 14z" />
    <path d="M19 8a3 3 0 0 1 0 6" />
    <path d="M7 14.5a3 3 0 0 0 5.7 1.3" />
  </svg>
)
export const OpIcon = (p: IP) => (
  <svg {...base(p)}>
    <path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" />
    <path d="M3 21h18" />
    <path d="M9 21v-4h6v4M9 7h2M13 7h2M9 11h2M13 11h2" />
  </svg>
)
export const EtcIcon = (p: IP) => (
  <svg {...base(p)}>
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </svg>
)

/* ---------- toolbar / ui ---------- */
export const PeriodIcon = (p: IP) => (
  <svg {...base(p)} strokeWidth={1.8}>
    <path d="M4 8h16M4 8a2 2 0 1 1 4 0 2 2 0 0 1-4 0M4 16h16M16 16a2 2 0 1 1 4 0 2 2 0 0 1-4 0" />
  </svg>
)
export const TrendIcon = (p: IP) => (
  <svg {...base(p)} strokeWidth={1.8}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)
export const GearIcon = (p: IP) => (
  <svg {...base(p)} strokeWidth={1.7}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.2.61.78 1.05 1.42 1.09H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)
export const BackArrow = (p: IP) => (
  <svg {...base(p)} strokeWidth={2.2}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
)
export const CloseIcon = (p: IP) => (
  <svg {...base(p)} strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const PlusIcon = (p: IP) => (
  <svg {...base(p)} strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const MinusIcon = (p: IP) => (
  <svg {...base(p)} strokeWidth={2.4}>
    <path d="M5 12h14" />
  </svg>
)
export const ExpandIcon = (p: IP) => (
  <svg {...base(p)} strokeWidth={2}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
)
export const ArrowRight = (p: IP) => (
  <svg {...base(p)} strokeWidth={2}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const TrashIcon = (p: IP) => (
  <svg {...base(p)} strokeWidth={1.9}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
)
