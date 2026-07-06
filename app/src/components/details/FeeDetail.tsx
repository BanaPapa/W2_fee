import { useState } from 'react'
import DetailHeader from './DetailHeader'
import { STAGE_COLOR } from '../ui/FeeStrip'
import { won, num } from '../../lib/format'
import {
  useFeeStore,
  feeStageRows,
  feePeriodRows,
  stageName,
  mgmTotal,
  mgmUnits,
  mgmBasisLabel,
  mgmBasisCumUnits,
  billTotal,
  orgTotal,
  feeCostTotal,
  MGM_PRICE_OPTIONS,
  MGM_RATE_OPTIONS,
  MGM_BASIS_OPTIONS,
  MIN_STAGE_COUNT,
  MAX_STAGE_COUNT,
  type MgmBasis,
  type StageId,
} from '../../store/feeStore'

const STEP_BTN_STYLE: React.CSSProperties = {
  width: 22, height: 18, border: '1px solid var(--border)', borderRadius: 4,
  background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 9, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1,
}

function AmountInput({ value, onUpdate, width = 110, fontSize }: { value: number; onUpdate: (v: number) => void; width?: number; fontSize?: number }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  return (
    <input
      className="field-input text-right"
      style={{ width, fontSize }}
      type="text"
      inputMode="numeric"
      value={editing ? raw : value.toLocaleString('ko-KR')}
      onFocus={() => { setEditing(true); setRaw(String(value)) }}
      onChange={(e) => {
        const s = e.target.value.replace(/[^0-9]/g, '')
        setRaw(s)
        onUpdate(parseInt(s) || 0)
      }}
      onBlur={() => setEditing(false)}
    />
  )
}

/** 조직 단가 입력 — 보통 백만원~천만원대이므로 폭을 넉넉히 두고 100만원 단위 스텝을 붙인다 */
function OrgPriceInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <button onClick={() => onCommit(value + 1_000_000)} style={STEP_BTN_STYLE} title="+100만원">▲</button>
        <button onClick={() => onCommit(Math.max(0, value - 1_000_000))} style={STEP_BTN_STYLE} title="-100만원">▼</button>
      </div>
      <input
        className="field-input text-right"
        style={{ width: 170 }}
        type="text"
        inputMode="numeric"
        value={editing ? raw : value.toLocaleString('ko-KR')}
        onFocus={() => { setEditing(true); setRaw(value > 0 ? String(value) : '') }}
        onChange={(e) => {
          const s = e.target.value.replace(/[^0-9]/g, '')
          setRaw(s)
          onCommit(parseInt(s) || 0)
        }}
        onBlur={() => setEditing(false)}
      />
    </div>
  )
}

/** 보고용 요약 타일 */
function ReportTile({
  label, valueNode, sub, profit, accentBorder,
}: {
  label: string
  valueNode: React.ReactNode
  sub?: React.ReactNode
  profit?: boolean
  accentBorder?: boolean
}) {
  return (
    <div
      className="rounded-[10px] border border-[var(--border)] px-4 py-3"
      style={{ borderColor: accentBorder ? 'var(--accent)' : undefined }}
    >
      <div className="text-[12.5px] font-bold text-[var(--muted)] tracking-[0.02em]">{label}</div>
      <div className="text-[19px] font-extrabold tabular mt-0.5" style={{ color: profit ? 'var(--teal)' : 'var(--ink)' }}>
        {valueNode}
      </div>
      {sub && <div className="text-[12px] text-[var(--muted)] mt-1">{sub}</div>}
    </div>
  )
}

/** 조직수수료/MGM을 담는 구획 — 제목과 부가설명을 헤더로, 내용은 아래에 그대로 편집 가능하게 보여준다 */
function Section({ title, hint, headerExtra, children }: { title: string; hint: string; headerExtra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-[var(--border)] p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h3 className="text-[17px] font-extrabold tracking-[-0.01em] m-0">{title}</h3>
          <div className="text-[13px] text-[var(--muted)] mt-0.5">{hint}</div>
        </div>
        {headerExtra}
      </div>
      {children}
    </div>
  )
}

export default function FeeDetail() {
  const fee = useFeeStore((s) => s)
  const { setTotalUnits, setBillUnitPrice, updateStageRate, assignPeriodStage, setStageCount, setMgmUnitPrice, setMgmRatePct, setMgmBasis } = useFeeStore()

  const stages = feeStageRows(fee)
  const periodRows = feePeriodRows(fee)
  const bill = billTotal(fee)
  const org = orgTotal(fee)
  const mgm = mgmTotal(fee)
  const mgmN = mgmUnits(fee)
  const basisLabel = mgmBasisLabel(fee)
  const basisCum = mgmBasisCumUnits(fee)

  const stageCountOptions = Array.from({ length: MAX_STAGE_COUNT - MIN_STAGE_COUNT + 1 }, (_, i) => MIN_STAGE_COUNT + i)

  // 분양률 기간 카드 드래그 → 단계 행에 드롭해서 적용 기간을 배정한다
  const [dragPeriod, setDragPeriod] = useState<string | null>(null)
  const [dropStage, setDropStage] = useState<StageId | null>(null)

  const periodDragProps = (key: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragPeriod(key)
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragEnd: () => { setDragPeriod(null); setDropStage(null) },
  })

  const stageDropProps = (id: StageId) => ({
    onDragOver: (e: React.DragEvent) => {
      if (dragPeriod === null) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropStage(id)
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropStage((cur) => (cur === id ? null : cur))
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      if (dragPeriod !== null) assignPeriodStage(dragPeriod, id)
      setDragPeriod(null)
      setDropStage(null)
    },
  })

  // 정당/예당은 한 카드로 합쳐 표시하고, 함께 움직인다 (드래그 키는 'contract')
  const contractRow = periodRows.find((r) => r.key === 'contract')
  const altRow = periodRows.find((r) => r.key === 'alt')
  const dPeriodRows = periodRows.filter((r) => r.key.startsWith('d'))
  // 1~12개월 / 13~24개월 … 12개월 단위 줄. 분양기간이 안 쓰는 달은 비활성 카드로 채운다.
  const monthRowCount = Math.max(1, Math.ceil(dPeriodRows.length / 12))
  const monthRows = Array.from({ length: monthRowCount }, (_, row) =>
    Array.from({ length: 12 }, (_, col) => ({
      n: row * 12 + col + 1,
      period: dPeriodRows[row * 12 + col] ?? null,
    }))
  )

  const fmtDate = (iso: string) => iso.slice(2).replaceAll('-', '.')

  return (
    <div className="pb-8" data-c="fee">
      <DetailHeader
        title="조직수수료 · MGM"
        subtitle="목표분양률 연동"
        total={feeCostTotal(fee)}
        actions={
          <>
            <label className="flex items-center gap-2 text-[17px] text-[var(--muted)] font-semibold">
              총 세대수
              <AmountInput value={fee.totalUnits} onUpdate={setTotalUnits} width={100} fontSize={17} />
            </label>
            <label className="flex items-center gap-2 text-[17px] text-[var(--muted)] font-semibold">
              세대당 단가
              <AmountInput value={fee.billUnitPrice} onUpdate={setBillUnitPrice} width={150} fontSize={17} />
            </label>
          </>
        }
      />

      <div className="px-6 pt-5 flex flex-col gap-5">
        {/* 손익 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ReportTile
            label="청구수수료 (수입) · 자동 계산"
            accentBorder
            valueNode={won(bill)}
            sub={`${num(fee.totalUnits)}세대 × ${won(fee.billUnitPrice)}`}
          />
          <ReportTile label="조직수수료 (지급)" valueNode={won(org)} />
          <ReportTile
            label="MGM · 소개수수료"
            valueNode={won(mgm)}
            sub={`${basisLabel}${fee.mgmBasis === 'all' ? '' : '까지'} 기준 · ${num(mgmN)}세대`}
          />
          <ReportTile label="수수료 마진" valueNode={won(bill - org - mgm)} profit />
        </div>

        {/* ---- 단계별 조직수수료 단가 ---- */}
        <Section
          title="단계별 조직수수료 단가"
          hint="하청업체 지급 · 세대당 단가 × 구간 세대수"
          headerExtra={
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[var(--muted)]">단계 수</span>
              <div className="flex gap-1">
                {stageCountOptions.map((n) => (
                  <button
                    key={n}
                    className="pill"
                    style={fee.stageCount === n ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : undefined}
                    onClick={() => setStageCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>단계</th>
                  <th>적용 기간</th>
                  <th style={{ textAlign: 'right' }}>세대수</th>
                  <th style={{ textAlign: 'right' }}>조직 단가</th>
                  <th style={{ textAlign: 'right' }}>조직수수료</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => {
                  const myPeriods = periodRows.filter((r) => r.stage === s.id)
                  // 정당/예당은 한 칩으로 합쳐 표시한다 (드래그하면 둘이 함께 이동)
                  const myChips = myPeriods.flatMap((r) => {
                    if (r.key === 'contract') {
                      return [{ key: 'contract', label: altRow && altRow.stage === s.id ? '정당/예당' : '정당' }]
                    }
                    if (r.key === 'alt') {
                      return contractRow && contractRow.stage === s.id ? [] : [{ key: 'alt', label: '예당' }]
                    }
                    return [{ key: r.key, label: r.label }]
                  })
                  const isDropTarget = dropStage === s.id
                  return (
                    <tr
                      key={s.id}
                      {...stageDropProps(s.id)}
                      style={{
                        background: isDropTarget ? 'color-mix(in oklch, var(--accent) 8%, transparent)' : undefined,
                        outline: isDropTarget ? '2px dashed var(--accent)' : undefined,
                        outlineOffset: isDropTarget ? -2 : undefined,
                        transition: 'background 0.12s',
                      }}
                    >
                      <td className="font-bold" style={{ whiteSpace: 'nowrap' }}>
                        <span
                          className="inline-block w-[10px] h-[10px] rounded-[3px] mr-2 align-middle"
                          style={{ background: STAGE_COLOR[s.id] }}
                          aria-hidden
                        />
                        {s.name}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', minHeight: 26 }}>
                          {myChips.length === 0 && (
                            <span className="text-[var(--muted)]">
                              {dragPeriod !== null ? '여기에 놓기' : '—'}
                            </span>
                          )}
                          {myChips.map((c) => (
                            <span
                              key={c.key}
                              {...periodDragProps(c.key)}
                              title="끌어서 다른 단계로 옮길 수 있습니다 (앞뒤 기간이 순서에 맞게 함께 이동)"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '2px 9px', borderRadius: 999,
                                border: '1px solid var(--border)', background: 'var(--surface-2)',
                                fontSize: 13, fontWeight: 700, color: 'var(--fg)',
                                cursor: 'grab', userSelect: 'none',
                                opacity: dragPeriod === c.key ? 0.35 : 1,
                              }}
                            >
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLOR[s.id] }} aria-hidden />
                              {c.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="num">{num(s.units)}</td>
                      <td className="num">
                        <OrgPriceInput value={s.org} onCommit={(v) => updateStageRate(s.id, { org: v })} />
                      </td>
                      <td className="num font-semibold">{won(s.orgTotal)}</td>
                    </tr>
                  )
                })}
                <tr>
                  <td className="font-extrabold">계</td>
                  <td></td>
                  <td className="num font-extrabold">{num(fee.totalUnits)}</td>
                  <td></td>
                  <td className="num font-extrabold">{won(org)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* ---- MGM ---- */}
        <Section title="MGM · 소개수수료" hint="기준 시점까지 누적 세대수 × 비율 × 세대당 단가">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[14px] font-semibold text-[var(--muted)]">
              기준 시점
              <select
                className="field-input !text-left !px-2"
                value={fee.mgmBasis}
                onChange={(e) => setMgmBasis(e.target.value as MgmBasis)}
              >
                {MGM_BASIS_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[14px] font-semibold text-[var(--muted)]">
              비율
              <select
                className="field-input !text-left !px-2"
                value={fee.mgmRatePct}
                onChange={(e) => setMgmRatePct(Number(e.target.value))}
              >
                {MGM_RATE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[14px] font-semibold text-[var(--muted)]">
              세대당 단가
              <select
                className="field-input !text-left !px-2"
                value={fee.mgmUnitPrice}
                onChange={(e) => setMgmUnitPrice(Number(e.target.value))}
              >
                {MGM_PRICE_OPTIONS.map((p) => (
                  <option key={p} value={p}>{num(p / 10000)}만 원</option>
                ))}
              </select>
            </label>
          </div>
          <div className="text-[15px] mt-3">
            <span className="text-[var(--muted)]">
              {basisLabel}{fee.mgmBasis === 'all' ? '' : '까지'} 누적 {num(basisCum)}세대 × {fee.mgmRatePct}% ={' '}
              {num(mgmN)}세대 × {num(fee.mgmUnitPrice / 10000)}만 원 ={' '}
            </span>
            <b className="text-[17px]">{won(mgm)}</b>
          </div>
        </Section>

        {/* ---- 목표분양률 참고 (카드를 끌어 단계에 배정) ---- */}
        <Section
          title="목표분양률"
          hint="참고용 · 카드를 끌어 위 '단계별 조직수수료 단가'의 행에 놓으면 그 단계로 배정됩니다 (세부 설정: 우측 상단 목표분양률)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 정당/예당 통합 카드 — 한 몸으로 움직인다 */}
            {contractRow && altRow && (
              <div>
                <div
                  {...periodDragProps('contract')}
                  title="끌어서 단계별 조직수수료 단가의 행에 놓으세요 (정당·예당이 함께 이동)"
                  style={{
                    display: 'inline-flex', flexDirection: 'column', gap: 3,
                    minWidth: 190, padding: '8px 12px', borderRadius: 12,
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    borderTop: `3px solid ${STAGE_COLOR[contractRow.stage]}`,
                    cursor: 'grab', userSelect: 'none',
                    opacity: dragPeriod === 'contract' ? 0.35 : 1,
                    boxShadow: 'var(--shadow)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>정당/예당</span>
                    <span className="tabular" style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {[contractRow.date, altRow.date].filter(Boolean).map((d) => fmtDate(d!)).join(' · ')}
                    </span>
                  </div>
                  <div className="tabular" style={{ fontSize: 13, color: 'var(--fg)', fontWeight: 600 }}>
                    {contractRow.ratePct + altRow.ratePct}% <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· 누적 {altRow.cumPct}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLOR[contractRow.stage] }} aria-hidden />
                    {stageName(contractRow.stage)}
                  </div>
                </div>
              </div>
            )}

            {/* D+n — 12개월 단위 줄 (1~12개월, 13~24개월 …), 분양기간이 안 쓰는 달은 비활성 */}
            <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 1080 }}>
                {monthRows.map((row, ri) => (
                  <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 6 }}>
                    {row.map(({ n, period: r }) =>
                      r ? (
                        <div
                          key={n}
                          {...periodDragProps(r.key)}
                          title="끌어서 단계별 조직수수료 단가의 행에 놓으세요 (앞뒤 기간이 순서에 맞게 함께 이동)"
                          style={{
                            display: 'flex', flexDirection: 'column', gap: 3,
                            padding: '7px 9px', borderRadius: 12,
                            border: '1px solid var(--border)', background: 'var(--surface)',
                            borderTop: `3px solid ${STAGE_COLOR[r.stage]}`,
                            cursor: 'grab', userSelect: 'none',
                            opacity: dragPeriod === r.key ? 0.35 : 1,
                            boxShadow: 'var(--shadow)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{r.label}</span>
                            {r.date && (
                              <span className="tabular" style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                {fmtDate(r.date)}
                              </span>
                            )}
                          </div>
                          <div className="tabular" style={{ fontSize: 12.5, color: 'var(--fg)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {r.ratePct}% <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· 누적 {r.cumPct}%</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLOR[r.stage], flexShrink: 0 }} aria-hidden />
                            {stageName(r.stage)}
                          </div>
                        </div>
                      ) : (
                        <div
                          key={n}
                          title="분양기간 밖의 달입니다"
                          style={{
                            display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center',
                            padding: '7px 9px', borderRadius: 12,
                            border: '1px dashed var(--border)', background: 'var(--surface-2)',
                            opacity: 0.45, userSelect: 'none',
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)' }}>D+{n}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>미사용</span>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
