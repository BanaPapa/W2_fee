import GroupedLedgerDetail from './GroupedLedgerDetail'
import { useAdStore } from '../../store/ledgerStore'

export default function AdvertisingDetail() {
  const items = useAdStore((s) => s.items)
  const groups = useAdStore((s) => s.groups)
  const { addItem, updateItem, removeItem, moveItem, setItemGroup, addGroup, removeGroup, reorderGroup } = useAdStore()

  return (
    <GroupedLedgerDetail
      title="광고비"
      cId="ad"
      items={items}
      groups={groups}
      addItem={addItem}
      updateItem={updateItem}
      removeItem={removeItem}
      moveItem={moveItem}
      setItemGroup={setItemGroup}
      addGroup={addGroup}
      removeGroup={removeGroup}
      reorderGroup={reorderGroup}
    />
  )
}
