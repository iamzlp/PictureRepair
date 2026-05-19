type PaginationBarProps = {
  page: number
  pageSize: number
  itemCount: number
  loading?: boolean
  onPageChange: (page: number) => void
}

export function PaginationBar({ page, pageSize, itemCount, loading, onPageChange }: PaginationBarProps) {
  const hasPrevious = page > 1
  const hasNext = itemCount >= pageSize
  const start = itemCount == 0 ? 0 : (page - 1) * pageSize + 1
  const end = (page - 1) * pageSize + itemCount

  return (
    <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-archive-paper/80 lg:flex-row lg:items-center lg:justify-between">
      <div>
        {itemCount > 0 ? `当前显示第 ${start}-${end} 条，本页 ${itemCount} 条` : '当前页没有更多记录'}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs tracking-[0.24em] text-archive-paper/45 uppercase">第 {page} 页</span>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevious || loading}
          className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-archive-paper transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          上一页
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || loading}
          className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-archive-paper transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  )
}
