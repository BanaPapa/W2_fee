import GroupedLedgerDetail from './GroupedLedgerDetail'
import { useOperatingStore } from '../../store/ledgerStore'

export default function OperatingDetail() {
  const items = useOperatingStore((s) => s.items)
  const groups = useOperatingStore((s) => s.groups)
  const { addItem, updateItem, removeItem, moveItem, setItemGroup, addGroup, removeGroup, reorderGroup } = useOperatingStore()

  return (
    <GroupedLedgerDetail
      title="운영비"
      cId="op"
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
