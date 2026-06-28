import Modal from '../ui/Modal'

const BARS = [
  { h: 38, label: '7월', v: '82.4M 원' },
  { h: 56, label: '8월', v: '121.8M 원' },
  { h: 68, label: '9월', v: '148.2M 원' },
  { h: 40, label: '10월', v: '86.2M 원' },
]

export default function TrendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="월별 비용 추이" sub="단계 기간에 맞춰 집계된 월별 집행" width={620}>
      <div className="trend">
        {BARS.map((b) => (
          <div key={b.label} className="tmonth" style={{ ['--h' as string]: `${b.h}%` }}>
            <i />
            <b>{b.v}</b>
            <span>{b.label}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}
