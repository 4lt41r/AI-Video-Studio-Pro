import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '../../store/ui'

export default function Notification() {
  const notification  = useUIStore(s => s.notification)
  const clearNotif    = useUIStore(s => s.clearNotification)

  const cfg = {
    success: { icon: CheckCircle2, cls: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' },
    error:   { icon: AlertCircle,  cls: 'bg-red-500/15 border-red-500/30 text-red-300' },
    info:    { icon: Info,         cls: 'bg-brand-500/15 border-brand-500/30 text-brand-300' },
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] pointer-events-none">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className={clsx(
              'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-sm',
              cfg[notification.type].cls,
            )}
          >
            {(() => { const Icon = cfg[notification.type].icon; return <Icon size={15} className="flex-shrink-0" /> })()}
            <p className="text-sm flex-1">{notification.message}</p>
            <button onClick={clearNotif} className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0">
              <X size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
