import { ArrowUpRight } from 'lucide-react'
import { ReactNode } from 'react'

type StatCardProps = {
  label: string
  value: string
  hint: string
  accent?: 'copper' | 'mist' | 'rose'
  icon?: ReactNode
}

const accentClasses = {
  copper: 'from-archive-copper/15 to-transparent border-archive-copper/30',
  mist: 'from-archive-mist/12 to-transparent border-white/10',
  rose: 'from-archive-rose/16 to-transparent border-archive-rose/30',
}

export function StatCard({ label, value, hint, accent = 'mist', icon }: StatCardProps) {
  return (
    <div className={`rounded-[28px] border bg-gradient-to-br ${accentClasses[accent]} p-5 shadow-soft-panel`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-archive-paper/45 uppercase">{label}</p>
          <p className="mt-4 font-display text-4xl text-white">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-archive-copper">
          {icon ?? <ArrowUpRight className="h-5 w-5" />}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-archive-mist">{hint}</p>
    </div>
  )
}
