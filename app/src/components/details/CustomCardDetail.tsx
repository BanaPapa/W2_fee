import GroupedLedgerDetail from './GroupedLedgerDetail'
import { useCustomCardsStore } from '../../store/customCardsStore'
import type { LineItem, LedgerGroup } from '../../store/ledgerStore'

// 안정적인(참조가 매번 바뀌지 않는) 빈 배열 — 셀렉터의 `?? []` 폴백으로 새 배열을 매번
// 만들면 zustand가 상태가 바뀐 걸로 오인해 무한 리렌더에 빠진다.
const EMPTY_ITEMS: LineItem[] = []
const EMPTY_GROUPS: LedgerGroup[] = []

/** 사용자가 추가한 카드 하나의 상세 화면. 카드가 몇 개든 이 컴포넌트가 재사용된다. */
export default function CustomCardDetail({ cardId }: { cardId: string }) {
  const card = useCustomCardsStore((s) => s.cards.find((c) => c.id === cardId))
  const items = useCustomCardsStore((s) => s.itemsByCard[cardId] ?? EMPTY_ITEMS)
  const groups = useCustomCardsStore((s) => s.groupsByCard[cardId] ?? EMPTY_GROUPS)
  const {
    addItem, updateItem, removeItem, moveItem, setItemGroup, addGroup, removeGroup, reorderGroup, removeCard,
  } = useCustomCardsStore()

  return (
    <GroupedLedgerDetail
      title={card?.name ?? '카드'}
      cId={cardId}
      items={items}
      groups={groups}
      addItem={(preset) => addItem(cardId, preset)}
      updateItem={(id, patch) => updateItem(cardId, id, patch)}
      removeItem={(id) => removeItem(cardId, id)}
      moveItem={(fromId, toId) => moveItem(cardId, fromId, toId)}
      setItemGroup={(id, groupKey) => setItemGroup(cardId, id, groupKey)}
      addGroup={(name) => addGroup(cardId, name)}
      removeGroup={(key) => removeGroup(cardId, key)}
      reorderGroup={(from, to) => reorderGroup(cardId, from, to)}
      onDeleteCard={() => {
        removeCard(cardId)
        // 상세 화면이 사라지므로 종합 현황으로 돌아간다 (AppShell의 hashchange 리스너가 처리)
        window.location.hash = ''
      }}
    />
  )
}
