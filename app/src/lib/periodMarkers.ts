// legacy keys that old persisted data might still contain
export const HIDDEN_KEYS = new Set(['special', 'rank2', 'lottery'])

export const KEY_DATE_MARKER_COLOR: Record<string, string> = {
  open:     '#d97706',   // 오픈일 — 밝은 노란색(amber)
  contract: '#16a34a',   // 정당계약 — 초록색
  alt:      '#7c3aed',   // 예당기간 — 보라색
}
