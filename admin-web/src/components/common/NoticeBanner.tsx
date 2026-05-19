import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

import { cn } from '@/lib/utils'

type NoticeBannerProps = {
  tone: 'success' | 'error' | 'info'
  message: string
}

const toneStyles: Record<NoticeBannerProps['tone'], { wrapper: string; icon: string; title: string }> = {
  success: {
    wrapper: 'border-emerald-400/25 bg-emerald-400/10',
    icon: 'text-emerald-200',
    title: 'text-emerald-100',
  },
  error: {
    wrapper: 'border-rose-400/25 bg-rose-400/10',
    icon: 'text-rose-200',
    title: 'text-rose-100',
  },
  info: {
    wrapper: 'border-sky-400/25 bg-sky-400/10',
    icon: 'text-sky-200',
    title: 'text-sky-100',
  },
}

export function NoticeBanner({ tone, message }: NoticeBannerProps) {
  const style = toneStyles[tone]
  const Icon = tone == 'success' ? CheckCircle2 : tone == 'error' ? AlertTriangle : Info
  const title = tone == 'success' ? '操作成功' : tone == 'error' ? '操作失败' : '操作提示'

  return (
    <div className={cn('rounded-[24px] border p-4 text-sm', style.wrapper)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.icon)} />
        <div>
          <p className={cn('font-semibold', style.title)}>{title}</p>
          <p className="mt-1 leading-7 text-archive-paper/85">{message}</p>
        </div>
      </div>
    </div>
  )
}
