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
import { AdminTransaction, fetchTransactions, normalizeError } from '@/utils/api'
import { formatDateTime } from '@/utils/format'

const PAGE_SIZE = 12

export function TransactionsPage() {
  const token = useAdminAuthStore((state) => state.token)
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<AdminTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [userId, setUserId] = useState(searchParams.get('user_id') || '')
  const [transactionType, setTransactionType] = useState(searchParams.get('transaction_type') || '')
  const [referenceId, setReferenceId] = useState(searchParams.get('reference_id') || '')
  const [page, setPage] = useState(Number(searchParams.get('page') || '1'))
  const [detailItem, setDetailItem] = useState<AdminTransaction | null>(null)

  function updateSearchParams(nextPage: number) {
    setSearchParams({
      ...(userId ? { user_id: userId } : {}),
      ...(transactionType ? { transaction_type: transactionType } : {}),
      ...(referenceId ? { reference_id: referenceId } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {}),
    })
  }

  async function loadTransactions(nextPage = page, successMessage?: string) {
    if (!token) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await fetchTransactions(token, {
        user_id: userId,
        transaction_type: transactionType,
        reference_id: referenceId,
        skip: (nextPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      })
      setItems(result)
      if (successMessage) {
        setNotice({ tone: 'success', message: successMessage })
      }
    } catch (err) {
      const message = normalizeError(err, '积分流水加载失败')
      setError(message)
      if (successMessage) {
        setNotice({ tone: 'error', message })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()
  }, [token])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextPage = 1
    setPage(nextPage)
    updateSearchParams(nextPage)
    setNotice({ tone: 'info', message: '已按新的流水条件重新检索。' })
    await loadTransactions(nextPage)
  }

  async function handlePageChange(nextPage: number) {
    setPage(nextPage)
    updateSearchParams(nextPage)
    await loadTransactions(nextPage)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Transactions"
        title="积分流水"
        description="用于核对每一次购买、导出和调账行为，快速定位“为什么次数变了”。"
        actions={
          <button
            type="button"
            onClick={() => loadTransactions(page, '积分流水已刷新。')}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-archive-paper transition hover:border-archive-copper/35 hover:bg-archive-copper/10 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            刷新流水
          </button>
        }
      />

      {notice ? <NoticeBanner tone={notice.tone} message={notice.message} /> : null}

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
        <form className="grid gap-4 xl:grid-cols-[1fr_220px_1fr_auto]" onSubmit={handleSearch}>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">用户 ID</span>
            <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="按用户 ID 筛选" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">流水类型</span>
            <input value={transactionType} onChange={(event) => setTransactionType(event.target.value)} placeholder="purchase / export / adjust" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">关联 ID</span>
            <input value={referenceId} onChange={(event) => setReferenceId(event.target.value)} placeholder="订单 ID 或任务 ID" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <button type="submit" className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-archive-copper px-5 text-sm font-semibold text-archive-ink transition hover:brightness-110">
            <Search className="h-4 w-4" />
            检索流水
          </button>
        </form>
      </section>

      <DataState loading={loading} error={error} empty={!loading && !error && items.length === 0} emptyTitle="没有找到积分流水" emptyDescription="可以尝试按用户 ID、关联任务 ID 或订单 ID 缩小范围。" />

      {!loading && !error && items.length > 0 ? (
        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] shadow-soft-panel">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left">
              <thead className="bg-white/[0.04] text-xs tracking-[0.24em] text-archive-paper/45 uppercase">
                <tr>
                  <th className="px-5 py-4">流水 ID</th>
                  <th className="px-5 py-4">用户 / 类型</th>
                  <th className="px-5 py-4">变动</th>
                  <th className="px-5 py-4">变动后余额</th>
                  <th className="px-5 py-4">关联对象</th>
                  <th className="px-5 py-4">说明 / 时间</th>
                  <th className="px-5 py-4">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-sm text-archive-paper/80">
                {items.map((item) => (
                  <tr key={item.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4 break-all text-xs">{item.id}</td>
                    <td className="px-5 py-4">
                      <p className="break-all text-xs text-archive-paper/70">{item.user_id}</p>
                      <div className="mt-2"><StatusBadge value={item.transaction_type} label={item.transaction_type} /></div>
                    </td>
                    <td className={`px-5 py-4 font-display text-2xl ${item.change >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{item.change > 0 ? `+${item.change}` : item.change}</td>
                    <td className="px-5 py-4">{item.balance_after}</td>
                    <td className="px-5 py-4 break-all text-xs text-archive-paper/70">{item.reference_id || '—'}</td>
                    <td className="px-5 py-4">
                      <p>{item.description || '—'}</p>
                      <p className="mt-1 text-xs text-archive-mist">{formatDateTime(item.created_at)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setDetailItem(item)}
                        className="rounded-full border border-white/10 px-3 py-2 text-xs text-archive-paper/75 transition hover:border-white/20 hover:text-white"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!loading && !error ? (
        <PaginationBar page={page} pageSize={PAGE_SIZE} itemCount={items.length} loading={loading} onPageChange={handlePageChange} />
      ) : null}

      <DetailDrawer
        open={!!detailItem}
        title={detailItem ? `${detailItem.transaction_type} 流水` : '流水详情'}
        subtitle={detailItem ? `流水 ID：${detailItem.id}` : undefined}
        meta={detailItem ? <StatusBadge value={detailItem.transaction_type} label={detailItem.transaction_type} /> : null}
        onClose={() => setDetailItem(null)}
      >
        {detailItem ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['用户 ID', detailItem.user_id],
              ['变动值', detailItem.change > 0 ? `+${detailItem.change}` : `${detailItem.change}`],
              ['变动后余额', `${detailItem.balance_after}`],
              ['关联对象', detailItem.reference_id || '—'],
              ['创建时间', formatDateTime(detailItem.created_at)],
              ['说明', detailItem.description || '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">{label}</p>
                <p className="mt-3 break-all text-sm leading-7 text-white">{value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  )
}
