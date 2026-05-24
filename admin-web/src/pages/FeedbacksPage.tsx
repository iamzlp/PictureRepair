import { FormEvent, useEffect, useState } from 'react'
import { MessageSquareQuote, RefreshCw, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { DataState } from '@/components/common/DataState'
import { DetailDrawer } from '@/components/common/DetailDrawer'
import { NoticeBanner } from '@/components/common/NoticeBanner'
import { PaginationBar } from '@/components/common/PaginationBar'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { AdminFeedback, fetchFeedbacks, normalizeError } from '@/utils/api'
import { formatDateTime } from '@/utils/format'

const PAGE_SIZE = 10

export function FeedbacksPage() {
  const token = useAdminAuthStore((state) => state.token)
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<AdminFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [feedbackType, setFeedbackType] = useState(searchParams.get('feedback_type') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [userId, setUserId] = useState(searchParams.get('user_id') || '')
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '')
  const [page, setPage] = useState(Number(searchParams.get('page') || '1'))
  const [detailItem, setDetailItem] = useState<AdminFeedback | null>(null)

  function updateSearchParams(nextPage: number) {
    setSearchParams({
      ...(feedbackType ? { feedback_type: feedbackType } : {}),
      ...(status ? { status } : {}),
      ...(userId ? { user_id: userId } : {}),
      ...(keyword ? { keyword } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {}),
    })
  }

  async function loadFeedbacks(nextPage = page, successMessage?: string) {
    if (!token) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await fetchFeedbacks(token, {
        feedback_type: feedbackType || undefined,
        status: status || undefined,
        user_id: userId || undefined,
        keyword: keyword || undefined,
        skip: (nextPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      })
      setItems(result)
      if (successMessage) {
        setNotice({ tone: 'success', message: successMessage })
      }
    } catch (err) {
      const message = normalizeError(err, '用户反馈加载失败')
      setError(message)
      if (successMessage) {
        setNotice({ tone: 'error', message })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFeedbacks()
  }, [token])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextPage = 1
    setPage(nextPage)
    updateSearchParams(nextPage)
    setNotice({ tone: 'info', message: '已按新的反馈条件重新检索。' })
    await loadFeedbacks(nextPage)
  }

  async function handlePageChange(nextPage: number) {
    setPage(nextPage)
    updateSearchParams(nextPage)
    await loadFeedbacks(nextPage)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Feedback"
        title="用户反馈"
        description="集中查看小程序用户提交的建议、问题和支付相关反馈，便于快速定位线上体验问题。"
        actions={
          <button
            type="button"
            onClick={() => loadFeedbacks(page, '反馈列表已刷新。')}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-archive-paper transition hover:border-archive-copper/35 hover:bg-archive-copper/10 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            刷新列表
          </button>
        }
      />

      {notice ? <NoticeBanner tone={notice.tone} message={notice.message} /> : null}

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
        <form className="grid gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]" onSubmit={handleSearch}>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">反馈类型</span>
            <input value={feedbackType} onChange={(event) => setFeedbackType(event.target.value)} placeholder="如 功能建议" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">状态</span>
            <input value={status} onChange={(event) => setStatus(event.target.value)} placeholder="如 submitted" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">用户 ID</span>
            <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="按用户 ID 精确筛选" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">关键词</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="按反馈内容模糊筛选" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <button type="submit" className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-archive-copper px-5 text-sm font-semibold text-archive-ink transition hover:brightness-110">
            <Search className="h-4 w-4" />
            检索反馈
          </button>
        </form>
      </section>

      <DataState loading={loading} error={error} empty={!loading && !error && items.length === 0} emptyTitle="暂无用户反馈" emptyDescription="当前还没有匹配到任何小程序反馈，可以稍后刷新或更换筛选条件。" />

      {!loading && !error && items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => (
            <section key={item.id} className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge value={item.feedback_type} label={item.feedback_type} />
                    <StatusBadge value={item.status} label={item.status} />
                    <button
                      type="button"
                      onClick={() => setDetailItem(item)}
                      className="rounded-full border border-white/10 px-3 py-1 text-[11px] tracking-[0.24em] text-archive-paper/75 uppercase transition hover:border-white/20 hover:text-white"
                    >
                      查看详情
                    </button>
                  </div>
                  <p className="mt-4 text-sm text-white">{item.user_nickname || item.user_phone || '匿名样式用户'}</p>
                  <p className="mt-1 break-all text-xs text-archive-mist">用户 ID：{item.user_id}</p>
                </div>
                <div className="text-sm text-archive-mist">{formatDateTime(item.created_at)}</div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                  <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">来源信息</p>
                  <p className="mt-3 text-sm text-white">来源：{item.source}</p>
                  <p className="mt-2 break-all text-sm text-archive-mist">页面：{item.page_path || '未记录页面路径'}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                  <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">反馈摘要</p>
                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap break-all text-sm leading-7 text-archive-paper/80">{item.content}</p>
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
        title={detailItem?.feedback_type || '反馈详情'}
        subtitle={detailItem ? `反馈 ID：${detailItem.id}` : undefined}
        meta={detailItem ? <StatusBadge value={detailItem.status} label={detailItem.status} /> : null}
        onClose={() => setDetailItem(null)}
      >
        {detailItem ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['用户昵称', detailItem.user_nickname || '未命名用户'],
                ['手机号', detailItem.user_phone || '未绑定手机号'],
                ['用户 ID', detailItem.user_id],
                ['来源页面', detailItem.page_path || '未记录页面路径'],
                ['反馈来源', detailItem.source],
                ['创建时间', formatDateTime(detailItem.created_at)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                  <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">{label}</p>
                  <p className="mt-3 break-all text-sm leading-7 text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">完整反馈内容</p>
              <div className="mt-3 flex items-start gap-3">
                <MessageSquareQuote className="mt-1 h-4 w-4 text-archive-copper" />
                <pre className="whitespace-pre-wrap break-all text-sm leading-7 text-archive-paper/80">{detailItem.content}</pre>
              </div>
            </div>
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  )
}
