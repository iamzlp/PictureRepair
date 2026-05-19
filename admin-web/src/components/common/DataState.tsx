import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-react'

type DataStateProps = {
  loading?: boolean
  error?: string | null
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

export function DataState({
  loading,
  error,
  empty,
  emptyTitle = '暂无数据',
  emptyDescription = '当前筛选条件下还没有可显示的记录。',
}: DataStateProps) {
  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04] text-archive-paper/75">
        <div className="flex items-center gap-3 text-sm tracking-[0.18em] uppercase">
          <LoaderCircle className="h-5 w-5 animate-spin text-archive-copper" />
          数据加载中
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-archive-rose/35 bg-archive-rose/10 p-6 text-sm text-archive-paper">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-archive-rose" />
          <div>
            <p className="font-semibold text-white">接口请求失败</p>
            <p className="mt-2 leading-7 text-archive-paper/75">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (empty) {
    return (
      <div className="rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-black/10 text-archive-mist">
          <Inbox className="h-6 w-6" />
        </div>
        <p className="mt-5 font-display text-2xl text-white">{emptyTitle}</p>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-archive-mist">{emptyDescription}</p>
      </div>
    )
  }

  return null
}
