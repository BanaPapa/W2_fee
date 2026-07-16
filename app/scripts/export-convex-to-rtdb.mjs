// Convex 로컬 배포에서 8개 문서를 읽어 Firebase RTDB import용 트리 JSON으로 저장한다.
// 실행: node scripts/export-convex-to-rtdb.mjs   (app 디렉터리에서, convex dev 켜진 상태)
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'
import { writeFileSync, readFileSync } from 'node:fs'

// .env.local 에서 VITE_CONVEX_URL 파싱 (dotenv 없이)
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const url = env.match(/^VITE_CONVEX_URL=(.+)$/m)?.[1]?.trim()
if (!url) throw new Error('VITE_CONVEX_URL 을 .env.local 에서 찾지 못했습니다')

const client = new ConvexHttpClient(url)

// Convex 시스템 필드(_id, _creationTime) 제거
const clean = (doc) => {
  if (!doc) return null
  const { _id, _creationTime, ...rest } = doc
  return rest
}

const [project, labor, meal, ad, operating, misc, fee, customCards] = await Promise.all([
  client.query(api.project.get, {}),
  client.query(api.labor.get, {}),
  client.query(api.meal.get, {}),
  client.query(api.ledger.get, { category: 'ad' }),
  client.query(api.ledger.get, { category: 'operating' }),
  client.query(api.ledger.get, { category: 'misc' }),
  client.query(api.fee.get, {}),
  client.query(api.customCards.get, {}),
])

const tree = {}
if (clean(project)) tree.project = clean(project)
if (clean(labor)) tree.labor = clean(labor)
if (clean(meal)) tree.meal = clean(meal)
if (clean(fee)) tree.fee = clean(fee)
if (clean(customCards)) tree.customCards = clean(customCards)
const ledgers = {}
if (clean(ad)) ledgers.ad = clean(ad)
if (clean(operating)) ledgers.operating = clean(operating)
if (clean(misc)) ledgers.misc = clean(misc)
if (Object.keys(ledgers).length) tree.ledgers = ledgers

writeFileSync(new URL('../firebase-seed.json', import.meta.url), JSON.stringify(tree, null, 2))

const summary = Object.fromEntries(
  Object.entries(tree).map(([k, v]) => [k, k === 'ledgers' ? Object.keys(v).join(',') : 'ok']),
)
console.log('firebase-seed.json 생성 완료:', JSON.stringify(summary))
