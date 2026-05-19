import { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        <p className="text-xs tracking-[0.35em] text-archive-paper/45 uppercase">{eyebrow}</p>
        <div>
          <h2 className="font-display text-4xl text-white">{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-archive-mist">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  )
}
