import { FormEvent, useEffect, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { DataState } from '@/components/common/DataState'
import { DetailDrawer } from '@/components/common/DetailDrawer'
import { NoticeBanner } from '@/components/common/NoticeBanner'
import { PaginationBar } from '@/components/common/PaginationBar'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { AdminAuditLog, fetchAuditLogs, normalizeError } from '@/utils/api'
import { formatDateTime, prettifyAction, prettifyTargetType } from '@/utils/format'

const PAGE_SIZE = 10

export function AuditLogsPage() {
  const token = useAdminAuthStore((state) => state.token)
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<AdminAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [action, setAction] = useState(searchParams.get('action') || '')
  const [targetType, setTargetType] = useState(searchParams.get('target_type') || '')
  const [adminUserId, setAdminUserId] = useState(searchParams.get('admin_user_id') || '')
  const [targetId, setTargetId] = useState(searchParams.get('target_id') || '')
  const [reason, setReason] = useState(searchParams.get('reason') || '')
  const [startAt, setStartAt] = useState(searchParams.get('start_at') || '')
  const [endAt, setEndAt] = useState(searchParams.get('end_at') || '')
  const [page, setPage] = useState(Number(searchParams.get('page') || '1'))
  const [detailItem, setDetailItem] = useState<AdminAuditLog | null>(null)

  function updateSearchParams(nextPage: number) {
    setSearchParams({
      ...(action ? { action } : {}),
      ...(targetType ? { target_type: targetType } : {}),
      ...(adminUserId ? { admin_user_id: adminUserId } : {}),
      ...(targetId ? { target_id: targetId } : {}),
      ...(reason ? { reason } : {}),
      ...(startAt ? { start_at: startAt } : {}),
      ...(endAt ? { end_at: endAt } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {}),
    })
  }

  async function loadAuditLogs(nextPage = page, successMessage?: string) {
    if (!token) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await fetchAuditLogs(token, {
        action,
        target_type: targetType,
        admin_user_id: adminUserId,
        target_id: targetId,
        reason,
        start_at: startAt || undefined,
        end_at: endAt || undefined,
        skip: (nextPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      })
      setItems(result)
      if (successMessage) {
        setNotice({ tone: 'success', message: successMessage })
      }
    } catch (err) {
      const message = normalizeError(err, '审计日志加载失败')
      setError(message)
      if (successMessage) {
        setNotice({ tone: 'error', message })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAuditLogs()
  }, [token])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextPage = 1
    setPage(nextPage)
    updateSearchParams(nextPage)
    setNotice({ tone: 'info', message: '已按新的审计条件重新检索。' })
    await loadAuditLogs(nextPage)
  }

  async function handlePageChange(nextPage: number) {
    setPage(nextPage)
    updateSearchParams(nextPage)
    await loadAuditLogs(nextPage)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Audit"
        title="审计日志"
        description="每一笔后台操作都应该可追溯。这里保留管理员的调账、任务重试等关键动作，方便复盘和责任追踪。"
        actions={
          <button
            type="button"
            onClick={() => loadAuditLogs(page, '审计日志已刷新。')}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-archive-paper transition hover:border-archive-copper/35 hover:bg-archive-copper/10 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            刷新日志
          </button>
        }
      />

      {notice ? <NoticeBanner tone={notice.tone} message={notice.message} /> : null}

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
        <form className="grid gap-4 xl:grid-cols-[repeat(3,minmax(0,1fr))]" onSubmit={handleSearch}>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">动作</span>
            <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="如 retry_task" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">目标类型</span>
            <input value={targetType} onChange={(event) => setTargetType(event.target.value)} placeholder="如 task 或 user" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">管理员 ID</span>
            <input value={adminUserId} onChange={(event) => setAdminUserId(event.target.value)} placeholder="按管理员 ID 精确筛选" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">目标 ID</span>
            <input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="按操作对象 ID 精确筛选" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">原因关键词</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="按 reason 模糊筛选" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">开始时间</span>
            <input value={startAt} onChange={(event) => setStartAt(event.target.value)} type="datetime-local" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">结束时间</span>
            <input value={endAt} onChange={(event) => setEndAt(event.target.value)} type="datetime-local" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none focus:border-archive-copper/40" />
          </label>
          <div className="mt-auto flex flex-wrap gap-3">
            <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-archive-copper px-5 text-sm font-semibold text-archive-ink transition hover:brightness-110">
              <Search className="h-4 w-4" />
              检索日志
            </button>
            <button
              type="button"
              onClick={async () => {
                setAction('')
                setTargetType('')
                setAdminUserId('')
                setTargetId('')
                setReason('')
                setStartAt('')
                setEndAt('')
                setPage(1)
                setSearchParams({})
                setNotice({ tone: 'info', message: '审计筛选条件已清空。' })
                setLoading(true)
                setError('')
                try {
                  const result = await fetchAuditLogs(token!, { skip: 0, limit: PAGE_SIZE })
                  setItems(result)
                } catch (err) {
                  setError(normalizeError(err, '审计日志加载失败'))
                } finally {
                  setLoading(false)
                }
              }}
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 px-5 text-sm text-archive-paper transition hover:border-white/20 hover:text-white"
            >
              清空筛选
            </button>
          </div>
        </form>
      </section>

      <DataState loading={loading} error={error} empty={!loading && !error && items.length === 0} emptyTitle="暂无审计日志" emptyDescription="当前后台还没有记录到匹配的管理员操作。" />

      {!loading && !error && items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => (
            <section key={item.id} className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge value={item.action} label={prettifyAction(item.action)} />
                    <StatusBadge value={item.target_type} label={prettifyTargetType(item.target_type)} />
                    <button
                      type="button"
                      onClick={() => setDetailItem(item)}
                      className="rounded-full border border-white/10 px-3 py-1 text-[11px] tracking-[0.24em] text-archive-paper/75 uppercase transition hover:border-white/20 hover:text-white"
                    >
                      查看详情
                    </button>
                  </div>
                  <p className="mt-4 break-all text-sm text-archive-paper/65">日志 ID：{item.id}</p>
                  <p className="mt-2 text-sm text-archive-mist">管理员：{item.admin_user_id}</p>
                </div>
                <div className="text-sm text-archive-mist">{formatDateTime(item.created_at)}</div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                  <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">操作对象</p>
                  <p className="mt-3 break-all text-sm text-white">目标 ID：{item.target_id || '—'}</p>
                  <p className="mt-3 text-sm leading-7 text-archive-mist">原因：{item.reason || '未填写原因'}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                    <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">变更前</p>
                    <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-archive-paper/75">{item.before_json || '—'}</pre>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                    <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">变更后</p>
                    <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-archive-paper/75">{item.after_json || '—'}</pre>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {!loading && !error ? (
        <PaginationBar page={page} pageSize={PAGE_SIZE} itemCount={items.length} loading={loading} onPageChange={handlePageChange} />
      ) : null}

      <DetailDrawer
        open={!!detailItem}
        title={detailItem ? prettifyAction(detailItem.action) : '审计详情'}
        subtitle={detailItem ? `日志 ID：${detailItem.id}` : undefined}
        meta={detailItem ? <StatusBadge value={detailItem.target_type} label={prettifyTargetType(detailItem.target_type)} /> : null}
        onClose={() => setDetailItem(null)}
      >
        {detailItem ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['管理员 ID', detailItem.admin_user_id],
                ['目标 ID', detailItem.target_id || '—'],
                ['原因', detailItem.reason || '—'],
                ['创建时间', formatDateTime(detailItem.created_at)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                  <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">{label}</p>
                  <p className="mt-3 break-all text-sm leading-7 text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">变更前</p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-archive-paper/75">{detailItem.before_json || '—'}</pre>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">变更后</p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-archive-paper/75">{detailItem.after_json || '—'}</pre>
              </div>
            </div>
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  )
}
