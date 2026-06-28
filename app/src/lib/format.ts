// ko-KR currency / number formatting helpers

export const won = (n: number): string => Math.round(n).toLocaleString('ko-KR') + ' 원'

/** Compact form: 46.1M 원 style used in card backs / summaries. */
export const wonCompact = (n: number): string => {
  if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(1) + '억 원'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M 원'
  if (Math.abs(n) >= 1e4) return Math.round(n / 1e4) + '만 원'
  return won(n)
}

export const num = (n: number): string => n.toLocaleString('ko-KR')

/** Parse a user-entered currency string like "1,200,000 원" or "120만" into a number. */
export const parseWon = (s: string): number => {
  const t = s.replace(/[₩,\s원]/g, '')
  if (/억$/.test(t)) return Math.round(parseFloat(t) * 1e8)
  if (/만$/.test(t)) return Math.round(parseFloat(t) * 1e4)
  const v = parseFloat(t)
  return Number.isFinite(v) ? v : 0
}

export const fmtMD = (m: number, d: number): string =>
  String(m + 1).padStart(2, '0') + '.' + String(d).padStart(2, '0')
