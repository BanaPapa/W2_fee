import { won, wonCompact } from '../../lib/format'
import { useTotals } from '../../store/totals'
import { useFeeStore, feePeriodRows } from '../../store/feeStore'
import { useUIStore } from '../../store/uiStore'
import { useCountUp } from '../../lib/useCountUp'
import FeeStrip from '../ui/FeeStrip'

const openFee = () => { window.location.hash = 'fee' }

export default function Overview({ mode }: { mode: 'grid' | 'split' }) {
  const { grand, bill, profit, totalUnits } = useTotals()
  const fee = useFeeStore((s) => s)
  const openModal = useUIStore((s) => s.openModal)
  const animatedBill = useCountUp(bill)
  const split = mode === 'split'
  const perUnit = totalUnits > 0 ? bill / totalUnits : 0
  const feeRows = feePeriodRows(fee)
  const finalRow = feeRows[feeRows.length - 1]

  return (
    <section
      className={
        split
          ? 'text-left pt-2 pb-1 pl-1 pr-1.5 border-b border-[color-mix(in_oklch,var(--border)_76%,transparent)]'
          : 'text-center pb-10'
      }
    >
      <div className="kicker" style={{ fontSize: split ? 12 : 13 }}>
        청구수수료 · 세대당 {wonCompact(perUnit)}
      </div>
      <button
        className="grand block bg-transparent border-0 p-0 cursor-pointer"
        style={{
          fontSize: split ? 'clamp(26px,2.6vw,38px)' : 'clamp(43px,8vw,92px)',
          margin: split ? '8px 0 10px' : '14px auto 14px',
          color: 'inherit',
          fontFamily: 'inherit',
        }}
        onClick={openFee}
        aria-label="수수료 상세 열기"
      >
        {won(animatedBill)}
      </button>
      <div className="uline" style={{ width: 56, margin: split ? '0 0 12px' : '0 auto 16px' }} />

      {split ? (
        // 축소 모드(카드 열림): 좌측 사이드에 간결한 인라인 표기
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 justify-start text-[14px]">
          <span className="text-[var(--muted)]">
            비용 <b className="text-[var(--ink)] tabular">{wonCompact(grand)}</b>
          </span>
          <span className="text-[var(--muted)]">
            순이익{' '}
            <b className="tabular" style={{ color: profit >= 0 ? 'var(--teal)' : 'var(--rose, #e34948)' }}>
              {wonCompact(profit)}
            </b>
          </span>
        </div>
      ) : (
        // 메인 모드: 청구수수료(위 큰 숫자) − 비용 = 순이익 산수식
        <div className="mx-auto" style={{ maxWidth: 'min(92vw, 460px)' }}>
          <div className="flex items-baseline" style={{ gap: 12 }}>
            <span style={{ width: 20, textAlign: 'center', color: 'var(--muted)', fontWeight: 700, fontSize: 22, lineHeight: 1 }}>−</span>
            <span className="text-[var(--muted)]" style={{ fontSize: 16.5 }}>비용</span>
            <b className="tabular text-[var(--ink)]" style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 700 }}>{won(grand)}</b>
          </div>
          <div style={{ height: 2, background: 'var(--border)', borderRadius: 2, margin: '10px 0' }} />
          <div className="flex items-baseline" style={{ gap: 12 }}>
            <span style={{ width: 20, textAlign: 'center', color: 'var(--muted)', fontWeight: 700, fontSize: 22, lineHeight: 1 }}>=</span>
            <span className="text-[var(--muted)]" style={{ fontSize: 16.5 }}>순이익</span>
            <b className="tabular" style={{ marginLeft: 'auto', fontSize: 25, fontWeight: 800, color: profit >= 0 ? 'var(--teal)' : 'var(--rose, #e34948)' }}>
              {won(profit)}
            </b>
          </div>
          <div className="flex justify-center" style={{ marginTop: 16 }}>
            <span className="meta-chip">{totalUnits.toLocaleString('ko-KR')}세대</span>
          </div>
        </div>
      )}

      {!split && (
        <button
          className="block bg-transparent border-0 p-0 cursor-pointer mx-auto mt-6 w-full max-w-[420px]"
          onClick={() => openModal('target')}
          aria-label="목표분양률 열기"
        >
          <FeeStrip doc={fee} height={40} />
          <div className="text-[12px] text-[var(--muted)] mt-1.5 font-semibold tracking-[0.04em]">
            목표분양률 · 정당 → {finalRow?.label ?? ''} 누적 {finalRow?.cumPct ?? 0}%
          </div>
        </button>
      )}
    </section>
  )
}
