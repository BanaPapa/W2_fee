import { internalMutation } from './_generated/server'

const MS_DAY = 86400000

const toDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const toIso = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const nextSaturdayOfWeek = (ms: number): number => {
  const dow = new Date(ms).getDay()
  return ms + ((6 - dow + 7) % 7) * MS_DAY
}

// mirrors src/store/projectStore.ts#calcMainKeyDates
const calcMainKeyDates = (openDateStr: string, openDays: 3 | 10 = 3, contractDays = 3) => {
  const o = toDate(openDateStr).getTime()
  const r1 = openDays + 1
  const win = r1 + 7
  const con = win + 11
  const conEnd = con + contractDays - 1
  const altMs = nextSaturdayOfWeek(o + conEnd * MS_DAY)
  return [
    { key: 'open', label: '오픈일', date: openDateStr },
    { key: 'rank1', label: '1순위', date: toIso(o + r1 * MS_DAY) },
    { key: 'winner', label: '당첨자발표', date: toIso(o + win * MS_DAY) },
    { key: 'contract', label: '정당계약', date: toIso(o + con * MS_DAY) },
    { key: 'alt', label: '예당계약', date: toIso(altMs) },
  ]
}

export const seedAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!(await ctx.db.query('project').first())) {
      await ctx.db.insert('project', {
        title: '강남 리버파크 분양 제안',
        pm: '김서연 PM',
        periodStart: '2026-06-01',
        periodEnd: '2026-11-14',
        extras: [],
        stages: [
          {
            id: 'presales',
            name: '사전영업',
            start: '2026-06-01',
            end: '2026-07-02',
            color: 'teal',
            enabled: true,
            subPeriods: [
              { key: 'planning', label: '기획투입', start: '2026-06-01', end: '2026-06-20' },
              { key: 'sales', label: '영업투입', start: '2026-06-10', end: '2026-07-02' },
            ],
          },
          {
            id: 'main',
            name: '본 영업',
            start: '2026-07-03',
            end: '2026-07-29',
            color: 'accent',
            enabled: true,
            openDays: 3,
            contractDays: 3,
            keyDates: calcMainKeyDates('2026-07-03', 3, 3),
          },
          {
            id: 'noorder',
            name: '무순위',
            start: '2026-07-30',
            end: '2026-08-20',
            color: 'violet',
            enabled: false,
          },
          {
            id: 'postsales',
            name: '사후영업',
            start: '2026-07-30',
            end: '2026-08-31',
            color: 'slate',
            enabled: true,
          },
        ],
        eventBlocks: [
          { id: 'union_contract', name: '조합계약', enabled: false, days: 5, daysOptions: [3, 5, 7, 14] },
          { id: 'option_contract', name: '옵션계약', enabled: false, days: 3, daysOptions: [1, 3, 5, 7] },
          { id: 'interim_sign', name: '중도금 자서', enabled: false, days: 3, daysOptions: [1, 3, 5, 7] },
        ],
      })
    }

    if (!(await ctx.db.query('labor').first())) {
      await ctx.db.insert('labor', {
        sectionNames: { planning: '기획', sales: '영업', other: '기타' },
        roles: [
          { name: '총괄 디렉터', daily: 420000, section: 'planning', people: [{ s: [6, 1], e: [9, 31] }] },
          {
            name: '기획 팀장',
            daily: 320000,
            section: 'planning',
            people: [
              { s: [6, 8], e: [9, 15] },
              { s: [6, 20], e: [9, 30] },
            ],
          },
          {
            name: '메인 기획자',
            daily: 240000,
            section: 'planning',
            people: [
              { s: [6, 15], e: [9, 31] },
              { s: [6, 15], e: [8, 31] },
              { s: [7, 1], e: [9, 31] },
            ],
          },
          {
            name: '상담 컨설턴트',
            daily: 180000,
            section: 'planning',
            people: [
              { s: [7, 1], e: [9, 10] },
              { s: [7, 1], e: [9, 30] },
              { s: [6, 20], e: [8, 31] },
              { s: [7, 8], e: [9, 10] },
              { s: [7, 1], e: [9, 10] },
              { s: [6, 15], e: [9, 15] },
              { s: [7, 1], e: [9, 30] },
              { s: [7, 8], e: [8, 31] },
            ],
          },
        ],
      })
    }

    if (!(await ctx.db.query('meal').first())) {
      await ctx.db.insert('meal', {
        lunchPerDay: 9000,
        dinnerPerDay: 12000,
        woesing: 1000000,
        dinnerRoleOverrides: {},
      })
    }

    const seedLedger = async (
      category: 'ad' | 'operating' | 'misc',
      items: { name: string; amount: number; qty: number; period: string; type: '1회성' | '일별' | '월별' | '수동'; status: '확정' | '검토중' | '작성중' }[],
      chips: string[],
    ) => {
      const existing = await ctx.db
        .query('ledgers')
        .withIndex('by_category', (q) => q.eq('category', category))
        .first()
      if (existing) return
      await ctx.db.insert('ledgers', {
        category,
        chips,
        items: items.map((it, i) => ({ ...it, id: `${category}-seed-${i}` })),
      })
    }

    await seedLedger(
      'ad',
      [
        { name: '온라인 광고 (포털/SNS)', amount: 8000000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
        { name: '전단지 제작·배포', amount: 6800000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
        { name: '현수막·옥외', amount: 12000000, qty: 1, period: '8월', type: '1회성', status: '검토중' },
        { name: '모델하우스 운영', amount: 450000, qty: 60, period: '8~9월', type: '일별', status: '확정' },
      ],
      ['온라인 광고', '전단지', '현수막', '버스/지하철', '문자 발송', '블로그 체험단'],
    )

    await seedLedger(
      'operating',
      [
        { name: '사무실 임대', amount: 9200000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
        { name: '장비 임대 (PC·프린터)', amount: 4200000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
        { name: '교통·주차', amount: 9100000, qty: 1, period: '전 기간', type: '수동', status: '검토중' },
        { name: '통신·인터넷', amount: 320000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
      ],
      ['사무실 임대', '장비 임대', '교통', '통신', '소모품', '수도광열'],
    )

    await seedLedger(
      'misc',
      [
        { name: '현장 예비비', amount: 8000000, qty: 1, period: '전 기간', type: '수동', status: '검토중' },
        { name: '소모품', amount: 1175000, qty: 4, period: '7~10월', type: '월별', status: '확정' },
        { name: '추가 인력 지원', amount: 5000000, qty: 1, period: '9월', type: '1회성', status: '작성중' },
      ],
      ['현장 예비비', '소모품', '추가 지원', '경조사', '간담회', '기타'],
    )
  },
})
