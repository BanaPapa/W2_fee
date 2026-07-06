import { useState } from 'react'
import Modal from '../ui/Modal'
import FeeStrip, { STAGE_COLOR } from '../ui/FeeStrip'
import { num } from '../../lib/format'
import { useFeeStore, feePeriodRows, activeStageMeta, type StageId } from '../../store/feeStore'

function UnitsInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  return (
    <input
      className="field-input text-right"
      style={{ width: 90 }}
      type="text"
      inputMode="numeric"
      value={editing ? raw : value.toLocaleString('ko-KR')}
      onFocus={() => { setEditing(true); setRaw(String(value)) }}
      onChange={(e) => {
        const s = e.target.value.replace(/[^0-9]/g, '')
        setRaw(s)
        onCommit(parseInt(s) || 0)
      }}
      onBlur={() => setEditing(false)}
    />
  )
}

function HeroStat({ label, children, glow, warn, danger }: { label: string; children: React.ReactNode; glow?: boolean; warn?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-[10px] border border-[var(--border)] px-4 py-3 flex-1 min-w-[140px]">
      <div className="text-[12.5px] font-bold text-[var(--muted)] tracking-[0.02em]">{label}</div>
      <div
        className={`font-display text-[28px] font-extrabold tabular mt-0.5 ${glow ? 'rate-glow' : warn && !danger ? 'rate-gradient' : ''}`}
        style={{ color: danger ? 'var(--rose, #e34948)' : glow || warn ? undefined : 'var(--ink)' }}
      >
        {children}
      </div>
    </div>
  )
}

export default function TargetRateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fee = useFeeStore((s) => s)
  const { setTotalUnits, updatePeriod, assignPeriodStage, autoDistributeRates } = useFeeStore()
  const rows = feePeriodRows(fee)
  const lastRow = rows[rows.length - 1]
  const finalCumPct = lastRow?.cumPct ?? 0
  const isComplete = finalCumPct === 100

  // 자동 배분: 최초 계약률(정당+예당 합)을 입력받아 나머지를 D+n에 점감 배분
  const [autoOpen, setAutoOpen] = useState(false)
  const [initRateRaw, setInitRateRaw] = useState('')
  const currentInitial = (rows[0]?.ratePct ?? 0) + (rows[1]?.ratePct ?? 0)
  const applyAuto = () => {
    autoDistributeRates(Number(initRateRaw) || 0)
    setAutoOpen(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="목표분양률"
      sub="D+n = 정당계약 첫날 + n개월 · 분양기간에 맞춰 자동 생성 (12개월 이상도 지원)"
      widthCss="min(1180px, 92vw)"
      heightCss="88vh"
      headerControls={
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {autoOpen ? (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>
                최초 계약률 (정당+예당)
                <input
                  autoFocus
                  className="field-input text-right"
                  style={{ width: 64 }}
                  type="number"
                  min={0}
                  max={100}
                  value={initRateRaw}
                  onChange={(e) => setInitRateRaw(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyAuto() }}
                />
                %
              </label>
              <button
                className="pill"
                style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}
                onClick={applyAuto}
              >
                배분
              </button>
              <button className="pill" onClick={() => setAutoOpen(false)}>취소</button>
            </>
          ) : (
            <button
              className="pill"
              title="최초 계약률을 입력하면 나머지 분양률을 초기 개월에 많고 점차 줄어들게 자동 배분합니다"
              onClick={() => { setInitRateRaw(String(currentInitial || '')); setAutoOpen(true) }}
            >
              자동 배분
            </button>
          )}
        </div>
      }
    >
      <div className="flex-1 flex flex-col overflow-y-auto" style={{ minHeight: 0, padding: '22px 26px 26px', gap: 20 }}>
        {/* 핵심 지표 3종 — 헷갈리지 않도록 누적/완료 시점을 크게 보여준다 */}
        <div className="flex flex-wrap gap-3">
          <HeroStat label="누적 분양률 (최종)" glow={isComplete} warn={!isComplete} danger={finalCumPct > 100}>
            {finalCumPct}%
          </HeroStat>
          <div className="rounded-[10px] border border-[var(--border)] px-4 py-3 flex-1 min-w-[140px]">
            <div className="text-[12.5px] font-bold text-[var(--muted)] tracking-[0.02em]">총 세대수</div>
            <div className="mt-0.5"><UnitsInput value={fee.totalUnits} onCommit={setTotalUnits} /></div>
          </div>
          <HeroStat label="완료 시점" glow={isComplete}>
            {lastRow ? lastRow.label : '—'}
          </HeroStat>
        </div>

        {!isComplete && (
          <div className="text-[13.5px] font-bold" style={{ color: 'var(--rose, #e34948)' }}>
            누적 분양률이 {finalCumPct}%{finalCumPct > 100 ? '로 100%를 초과했습니다' : '입니다'} — 100%가 되도록 구간별 값을 조정하세요. (분양기간이 바뀌면 이 값이 다시 어긋날 수 있어요)
          </div>
        )}

        {/* 시각화 — 구간이 12개월을 넘어가도 막대가 얇아지지 않도록 가로 스크롤 */}
        <FeeStrip doc={fee} height={70} showLabels scrollable minBarWidth={34} />

        {/* 구간별/누적 데이터 — 두 그룹을 명확히 분리해 표시 */}
        <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ verticalAlign: 'bottom' }}>기간</th>
                <th colSpan={2} style={{ textAlign: 'center', background: 'color-mix(in oklch, var(--accent) 8%, transparent)' }}>누적</th>
                <th colSpan={2} style={{ textAlign: 'center', background: 'var(--surface-2)' }}>구간</th>
                <th rowSpan={2} style={{ verticalAlign: 'bottom', textAlign: 'center' }}>수수료 단계</th>
              </tr>
              <tr>
                <th style={{ textAlign: 'right', background: 'color-mix(in oklch, var(--accent) 8%, transparent)' }}>분양률</th>
                <th style={{ textAlign: 'right', background: 'color-mix(in oklch, var(--accent) 8%, transparent)' }}>세대수</th>
                <th style={{ textAlign: 'right', background: 'var(--surface-2)' }}>분양률</th>
                <th style={{ textAlign: 'right', background: 'var(--surface-2)' }}>세대수</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isLast = i === rows.length - 1
                return (
                  <tr key={r.key}>
                    <td className="font-bold">
                      <span
                        className="inline-block w-[10px] h-[10px] rounded-[3px] mr-2 align-middle"
                        style={{ background: STAGE_COLOR[r.stage] }}
                        aria-hidden
                      />
                      <span className={isLast && isComplete ? 'rate-glow' : undefined}>{r.label}</span>
                      {r.date && (
                        <span className="ml-2 text-[13px] font-normal text-[var(--muted)] tabular">
                          {r.date.slice(2).replaceAll('-', '.')}
                        </span>
                      )}
                    </td>
                    <td
                      className="num"
                      title={r.cumPct > 100 ? '누적 분양률이 100%를 초과했습니다 — 구간별 값을 조정하세요' : undefined}
                      style={{
                        background: 'color-mix(in oklch, var(--accent) 8%, transparent)',
                        color: r.cumPct > 100 || (isLast && !isComplete)
                          ? 'var(--rose, #e34948)'
                          : isLast ? undefined : 'var(--muted)',
                        fontWeight: r.cumPct > 100 || isLast ? 800 : undefined,
                      }}
                    >
                      <span className={isLast && isComplete ? 'rate-glow' : undefined}>
                        {r.cumPct}%{r.cumPct > 100 ? ' ⚠' : ''}
                      </span>
                    </td>
                    <td className="num font-semibold" style={{ background: 'color-mix(in oklch, var(--accent) 8%, transparent)' }}>
                      {num(r.cumUnits)}
                    </td>
                    <td className="num" style={{ background: 'var(--surface-2)' }}>
                      <input
                        className="field-input w-[64px] text-right"
                        type="number"
                        min={0}
                        max={100}
                        value={r.ratePct}
                        onChange={(e) => updatePeriod(r.key, { ratePct: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </td>
                    <td className="num font-semibold" style={{ background: 'var(--surface-2)' }}>{num(r.units)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <select
                        className="field-input !text-left !px-2"
                        value={r.stage}
                        onChange={(e) => assignPeriodStage(r.key, e.target.value as StageId)}
                      >
                        {activeStageMeta(fee).map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
