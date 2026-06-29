import { won } from '../../lib/format'
import { useTotals } from '../../store/totals'
import { useCountUp } from '../../lib/useCountUp'

export default function Overview({ mode }: { mode: 'grid' | 'split' }) {
  const { grand } = useTotals()
  const animated = useCountUp(grand)
  const split = mode === 'split'

  return (
    <section
      className={
        split
          ? 'text-left pt-2 pb-1 pl-1 pr-1.5 border-b border-[color-mix(in_oklch,var(--border)_76%,transparent)]'
          : 'text-center pb-16'
      }
    >
      <div className="kicker" style={{ fontSize: split ? 12 : 13 }}>
        종합 현황 · 5개 비용 합계
      </div>
      <div
        className="grand"
        style={{
          fontSize: split ? 'clamp(26px,2.6vw,38px)' : 'clamp(43px,8vw,92px)',
          margin: split ? '8px 0 10px' : '14px 0 14px',
        }}
      >
        {won(animated)}
      </div>
      <div className="uline" style={{ width: 56, margin: split ? '0 0 12px' : '0 auto 16px' }} />
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[var(--muted)] ${
          split ? 'justify-start text-[15px]' : 'justify-center text-[16.5px]'
        }`}
      >
        <span className="font-extrabold" style={{ color: 'var(--teal)' }}>
          전월 대비 +8.4%
        </span>
        {!split && <span className="meta-chip">검토 중</span>}
        <span>업데이트 2026-06-23 01:20</span>
      </div>
    </section>
  )
}
