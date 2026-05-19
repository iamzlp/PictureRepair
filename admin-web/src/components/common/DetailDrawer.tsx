import { ReactNode } from 'react'
import { X } from 'lucide-react'

type DetailDrawerProps = {
  open: boolean
  title: string
  subtitle?: string
  meta?: ReactNode
  onClose: () => void
  children: ReactNode
}

export function DetailDrawer({ open, title, subtitle, meta, onClose, children }: DetailDrawerProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-archive-panel shadow-soft-glow">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-archive-panel/95 px-6 py-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs tracking-[0.3em] text-archive-paper/40 uppercase">详情查看</p>
              <h3 className="font-display text-3xl text-white">{title}</h3>
              {subtitle ? <p className="text-sm leading-7 text-archive-mist">{subtitle}</p> : null}
              {meta ? <div className="pt-2">{meta}</div> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-archive-paper/70 transition hover:border-white/20 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  )
}
