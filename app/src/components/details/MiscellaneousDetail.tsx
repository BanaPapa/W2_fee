import GroupedLedgerDetail from './GroupedLedgerDetail'
import { useMiscStore } from '../../store/ledgerStore'

export default function MiscellaneousDetail() {
  const items = useMiscStore((s) => s.items)
  const groups = useMiscStore((s) => s.groups)
  const { addItem, updateItem, removeItem, moveItem, setItemGroup, addGroup, removeGroup, reorderGroup } = useMiscStore()

  return (
    <GroupedLedgerDetail
      title="기타비"
      cId="etc"
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
