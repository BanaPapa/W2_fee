import LedgerDetail from './LedgerDetail'
import { useAdStore } from '../../store/ledgerStore'

export default function AdvertisingDetail() {
  return <LedgerDetail title="광고비" cId="ad" useStore={useAdStore} />
}
