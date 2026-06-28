import type { ReactNode } from 'react'
import { won } from '../../lib/format'

interface Props {
  title: string
  total: number
  subtitle?: string
  actions?: ReactNode
}

export default function DetailHeader({ title, total, subtitle, actions }: Props) {
  return (
    <div className="sticky top-0 z-10 flex items-end justify-between gap-4 px-6 pt-5 pb-4 bg-[var(--surface)] border-b border-[var(--border)]">
      <div>
        <div className="kicker" style={{ fontSize: 13 }}>
          {title}
          {subtitle ? ` · ${subtitle}` : ''}
        </div>
        <div className="grand" style={{ fontSize: 'clamp(27px,2.6vw,37px)', margin: '6px 0 0' }}>
          {won(total)}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
