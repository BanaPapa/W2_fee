import LedgerDetail from './LedgerDetail'
import { useMiscStore } from '../../store/ledgerStore'

export default function MiscellaneousDetail() {
  return <LedgerDetail title="기타비" cId="etc" useStore={useMiscStore} />
}
