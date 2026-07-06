import { useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { CloseIcon } from '../icons'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  sub?: string
  children: ReactNode
  width?: number
  widthCss?: string
  maxHeightCss?: string
  heightCss?: string
  className?: string
  disableBackdropClose?: boolean
  headerControls?: ReactNode
}

export default function Modal({ open, onClose, title, sub, children, width, widthCss, maxHeightCss, heightCss, className, disableBackdropClose, headerControls }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="modal-bg"
            onClick={disableBackdropClose ? undefined : onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <div className="fixed inset-0 z-[51] grid place-items-center p-5 pointer-events-none">
            <motion.div
              className={`modal-card pointer-events-auto ${className ?? ''}`}
              style={{
                ...(widthCss ? { width: widthCss } : width ? { width: `min(${width}px, 95vw)` } : {}),
                ...(maxHeightCss ? { maxHeight: maxHeightCss } : {}),
                ...(heightCss ? { height: heightCss, overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {}),
              }}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              <div className="modal-head" style={{ alignItems: 'center', flexWrap: 'nowrap', gap: 10, paddingTop: 14 }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0 }}>{title}</h2>
                  {sub && <p className="sub">{sub}</p>}
                </div>
                {headerControls && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    {headerControls}
                  </div>
                )}
                <button className="x" style={{ flexShrink: 0 }} onClick={onClose} aria-label="닫기">
                  <CloseIcon />
                </button>
              </div>
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
