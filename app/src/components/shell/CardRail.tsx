import { useState } from 'react'
import { LayoutGroup } from 'motion/react'
import CategoryCard from './CategoryCard'
import Modal from '../ui/Modal'
import { CATEGORIES, type CategoryMeta } from '../../data/categories'
import { useTotals } from '../../store/totals'
import { useCustomCardsStore, isFixedCardId } from '../../store/customCardsStore'
import { EtcIcon } from '../icons'

interface Props {
  mode: 'grid' | 'split'
  active: string | null
  orderAnchor: string | null
  flipDir: 1 | -1
  flipNonce: number
  transitioning: boolean
  reduceMotion: boolean
  onSelect: (id: string) => void
}

export default function CardRail({
  mode,
  active,
  orderAnchor,
  flipDir,
  flipNonce,
  transitioning,
  reduceMotion,
  onSelect,
}: Props) {
  const { byId } = useTotals()
  const customCards = useCustomCardsStore((s) => s.cards)
  const itemsByCard = useCustomCardsStore((s) => s.itemsByCard)
  const cardOrder = useCustomCardsStore((s) => s.order)
  const removeCard = useCustomCardsStore((s) => s.removeCard)
  const split = mode === 'split'

  const [deleteCardId, setDeleteCardId] = useState<string | null>(null)
  const deleteCard = customCards.find((c) => c.id === deleteCardId)
  const deleteCardCount = deleteCardId ? (itemsByCard[deleteCardId] ?? []).length : 0

  // 내용이 비어 있어도 실수로 지우는 걸 막기 위해 항상 확인을 받는다
  const requestDelete = (id: string) => setDeleteCardId(id)
  const doDelete = (id: string) => {
    if (window.location.hash === '#' + id) window.location.hash = ''
    removeCard(id)
    setDeleteCardId(null)
  }

  // 저장된 순서(order)대로 고정 카드 + 사용자 카드를 이어붙인다 — 순서는 설정 > 카드 관리에서 바꿀 수 있다
  const allCategories: CategoryMeta[] = cardOrder.flatMap((id) => {
    const fixed = CATEGORIES.find((c) => c.id === id)
    if (fixed) return [fixed]
    const custom = customCards.find((c) => c.id === id)
    if (custom) return [{ id: custom.id, order: 0, name: custom.name, note: '사용자 추가', Icon: EtcIcon }]
    return []
  })

  const anchorIdx = Math.max(
    allCategories.findIndex((c) => c.id === (orderAnchor ?? allCategories[0].id)),
    0,
  )
  const n = allCategories.length
  const orderOf = (i: number) => (i >= anchorIdx ? i - anchorIdx : n - anchorIdx + i)

  return (
    <>
      <section
        className={
          split
            ? `flex flex-col gap-3 min-h-0 pr-1 py-2 ${transitioning ? 'overflow-visible' : 'overflow-y-auto'}`
            : 'grid w-full h-full'
        }
        style={split ? undefined : { gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 'clamp(20px, 2vw, 44px)' }}
        aria-label="비용 카테고리"
      >
        <LayoutGroup>
          {allCategories.map((meta, i) => (
            <CategoryCard
              key={meta.id}
              meta={meta}
              mode={mode}
              active={active === meta.id}
              order={orderOf(i)}
              flipDir={flipDir}
              flipNonce={flipNonce}
              amount={byId[meta.id] ?? 0}
              reduceMotion={reduceMotion}
              onSelect={onSelect}
              onDelete={isFixedCardId(meta.id) ? undefined : requestDelete}
            />
          ))}
        </LayoutGroup>
      </section>

      {/* ---- 카드 삭제 경고 (우클릭 삭제 — 내용이 있든 없든 항상 확인) ---- */}
      <Modal open={deleteCardId !== null} onClose={() => setDeleteCardId(null)} title="카드 삭제" width={400}>
        {deleteCardId !== null && (
          <div className="flex flex-col gap-5 pt-1">
            <p className="text-[17px] text-[var(--fg)]">
              <b>'{deleteCard?.name}'</b> 카드를 삭제할까요?<br />
              <span className="text-[var(--muted)] text-[15px]">
                {deleteCardCount > 0 ? `안에 있는 ${deleteCardCount}개 항목이 모두 함께 삭제되며, ` : ''}이 작업은 되돌릴 수 없습니다.
              </span>
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteCardId(null)}
                style={{ background: 'var(--surface-2)', color: 'var(--fg)', border: 'none', borderRadius: 10, padding: '0 20px', height: 36, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                취소
              </button>
              <button
                onClick={() => doDelete(deleteCardId)}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, padding: '0 20px', height: 36, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
