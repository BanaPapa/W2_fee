import LedgerDetail from './LedgerDetail'
import { useOperatingStore } from '../../store/ledgerStore'

export default function OperatingDetail() {
  return <LedgerDetail title="운영비" cId="op" useStore={useOperatingStore} />
}
