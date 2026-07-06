// Work-schedule calculations ported from labor.html.
// A "person" has an independent work window (s..e), an optional per-month
// pattern, and per-day overrides. Dates carry an explicit year so a person's
// window can span across a calendar year boundary (e.g. 사후영업 running into
// the following year).

/** [year, monthIndex0, day] */
export type YMD = [number, number, number]

export interface Person {
  s: YMD
  e: YMD
  /** per-month pattern, keyed `${year}-${month}`: 7 = every day, 6 = 6-day (off Wed, default), 5 = weekdays only */
  pat?: Record<string, number>
  /** per-day overrides, keyed `${year}-${month}-${day}` -> worked? */
  ov?: Record<string, boolean>
  /** per-extra-slot day overrides keyed by extra index */
  extraOv?: Record<number, number>
}

export interface MonthCell { year: number; month: number }

export const monthCellKey = (m: MonthCell): number => m.year * 12 + m.month

export const D = ([y, m, d]: YMD): Date => new Date(y, m, d)

export const monthKeyOf = (year: number, month: number): string => `${year}-${month}`
export const dayKeyOf = (year: number, month: number, day: number): string => `${year}-${month}-${day}`

export const patOf = (p: Person, year: number, month: number): number => {
  const k = monthKeyOf(year, month)
  return p.pat && p.pat[k] != null ? p.pat[k] : 6
}

export const dayWorks = (weekday: number, pat: number): boolean => {
  if (pat === 7) return true
  if (pat === 5) return weekday >= 1 && weekday <= 5
  return weekday !== 3 // 6-day: off Wednesday
}

export const isWorkP = (date: Date, p: Person): boolean => {
  if (date < D(p.s) || date > D(p.e)) return false
  const key = dayKeyOf(date.getFullYear(), date.getMonth(), date.getDate())
  if (p.ov && key in p.ov) return p.ov[key]
  return dayWorks(date.getDay(), patOf(p, date.getFullYear(), date.getMonth()))
}

/** planned paid days across the person's whole window (honours per-day overrides) */
export const ppdP = (p: Person): number => {
  let n = 0
  const d = new Date(D(p.s))
  const end = D(p.e)
  while (d <= end) {
    if (isWorkP(d, p)) n++
    d.setDate(d.getDate() + 1)
  }
  return n
}

/** working days within a given (year, month), honouring overrides */
export const monthWorkP = (p: Person, year: number, month: number): number => {
  let n = 0
  const dim = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= dim; d++) {
    if (isWorkP(new Date(year, month, d), p)) n++
  }
  return n
}

export const monthsOf = (p: Person): MonthCell[] => {
  const a: MonthCell[] = []
  let y = p.s[0]
  let m = p.s[1]
  const endKey = monthCellKey({ year: p.e[0], month: p.e[1] })
  while (y * 12 + m <= endKey) {
    a.push({ year: y, month: m })
    m++
    if (m > 11) { m = 0; y++ }
  }
  return a
}

const DAY_MS = 86400000

/**
 * 달력에서 특정 날짜를 클릭했을 때 적용할 patch를 계산한다.
 * - 근무기간(s~e) 안의 날짜: 그 날의 근무 여부만 뒤집는다.
 * - 근무기간 밖의 날짜: 그 날짜까지 기간을 넓히되, 새로 포함되는 다른 날짜는
 *   전부 비근무로 두고 클릭한 날짜만 근무로 표시한다.
 */
export function toggleWorkDay(p: Person, year: number, month: number, day: number): Partial<Person> {
  const date = new Date(year, month, day)
  const key = dayKeyOf(year, month, day)
  const inRange = date >= D(p.s) && date <= D(p.e)

  if (inRange) {
    const currently = isWorkP(date, p)
    return { ov: { ...(p.ov ?? {}), [key]: !currently } }
  }

  const sMs = D(p.s).getTime()
  const eMs = D(p.e).getTime()
  const dateMs = date.getTime()
  const newOv: Record<string, boolean> = { ...(p.ov ?? {}) }

  if (dateMs < sMs) {
    for (let ms = dateMs; ms < sMs; ms += DAY_MS) {
      const dd = new Date(ms)
      newOv[dayKeyOf(dd.getFullYear(), dd.getMonth(), dd.getDate())] = false
    }
    newOv[key] = true
    return { s: [year, month, day], ov: newOv }
  }

  for (let ms = eMs + DAY_MS; ms <= dateMs; ms += DAY_MS) {
    const dd = new Date(ms)
    newOv[dayKeyOf(dd.getFullYear(), dd.getMonth(), dd.getDate())] = false
  }
  newOv[key] = true
  return { e: [year, month, day], ov: newOv }
}

/** 근무기간(s~e)과 겹치는 날짜만 골라 해당 (year, month) 전체를 비근무로 덮어쓴다. */
export function clearMonth(p: Person, year: number, month: number): Partial<Person> {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const ov: Record<string, boolean> = { ...(p.ov ?? {}) }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    if (date >= D(p.s) && date <= D(p.e)) {
      ov[dayKeyOf(year, month, d)] = false
    }
  }
  return { ov }
}

/** 근무기간(s~e)과 겹치는 날짜만 골라 해당 (year, month) 전체를 선택된 주간 패턴(5·6·7일)에 맞춰 채운다. */
export function fillMonth(p: Person, year: number, month: number): Partial<Person> {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const ov: Record<string, boolean> = { ...(p.ov ?? {}) }
  const pattern = patOf(p, year, month)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    if (date >= D(p.s) && date <= D(p.e)) {
      ov[dayKeyOf(year, month, d)] = dayWorks(date.getDay(), pattern)
    }
  }
  return { ov }
}

export const DOW = ['일', '월', '화', '수', '목', '금', '토']

/** 프로젝트 기간(periodStart~periodEnd)에 해당하는 (연, 월) 목록. 해를 넘어가도 전부 포함한다. */
export function projectMonths(periodStart: string, periodEnd: string): MonthCell[] {
  const s = new Date(periodStart)
  const e = new Date(periodEnd)
  const months: MonthCell[] = []
  let y = s.getFullYear()
  let m = s.getMonth()
  const endKey = e.getFullYear() * 12 + e.getMonth()
  while (y * 12 + m <= endKey) {
    months.push({ year: y, month: m })
    m++
    if (m > 11) { m = 0; y++ }
  }
  return months
}
