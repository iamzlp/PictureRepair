import { cn } from '@/lib/utils'

const toneMap: Record<string, string> = {
  completed: 'border-emerald-400/30 bg-emerald-400/12 text-emerald-200',
  processing: 'border-sky-400/30 bg-sky-400/12 text-sky-200',
  pending: 'border-amber-400/30 bg-amber-400/12 text-amber-200',
  submitted: 'border-indigo-400/30 bg-indigo-400/12 text-indigo-200',
  downloading: 'border-cyan-400/30 bg-cyan-400/12 text-cyan-200',
  failed: 'border-rose-400/30 bg-rose-400/12 text-rose-200',
  mock_paid: 'border-emerald-400/30 bg-emerald-400/12 text-emerald-200',
  adjust: 'border-archive-copper/30 bg-archive-copper/12 text-archive-copper',
  purchase: 'border-fuchsia-300/30 bg-fuchsia-300/12 text-fuchsia-100',
  export: 'border-sky-400/30 bg-sky-400/12 text-sky-200',
  user: 'border-amber-400/30 bg-amber-400/12 text-amber-200',
  task: 'border-indigo-400/30 bg-indigo-400/12 text-indigo-200',
}

export function StatusBadge({ value, label }: { value: string | boolean; label?: string }) {
  const key = String(value).toLowerCase()

  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.24em] uppercase',
        toneMap[key] ?? 'border-white/10 bg-white/5 text-archive-paper/75'
      )}
    >
      {label ?? String(value)}
    </span>
  )
}
