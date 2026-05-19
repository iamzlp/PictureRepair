import { FormEvent, useEffect, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { DataState } from '@/components/common/DataState'
import { NoticeBanner } from '@/components/common/NoticeBanner'
import { PaginationBar } from '@/components/common/PaginationBar'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { AdminOrder, fetchOrders, normalizeError } from '@/utils/api'
import { formatCurrency, formatDateTime } from '@/utils/format'

const PAGE_SIZE = 10

export function OrdersPage() {
  const navigate = useNavigate()
  const token = useAdminAuthStore((state) => state.token)
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [packageId, setPackageId] = useState(searchParams.get('package_id') || '')
  const [userId, setUserId] = useState(searchParams.get('user_id') || '')
  const [page, setPage] = useState(Number(searchParams.get('page') || '1'))

  function updateSearchParams(nextPage: number) {
    setSearchParams({
      ...(status ? { status } : {}),
      ...(packageId ? { package_id: packageId } : {}),
      ...(userId ? { user_id: userId } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {}),
    })
  }

  async function loadOrders(nextPage = page, successMessage?: string) {
    if (!token) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await fetchOrders(token, {
        status,
        package_id: packageId,
        user_id: userId,
        skip: (nextPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      })
      setOrders(result)
      if (successMessage) {
        setNotice({ tone: 'success', message: successMessage })
      }
    } catch (err) {
      const message = normalizeError(err, '订单列表加载失败')
      setError(message)
      if (successMessage) {
        setNotice({ tone: 'error', message })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [token])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextPage = 1
    setPage(nextPage)
    updateSearchParams(nextPage)
    setNotice({ tone: 'info', message: '已按新的订单条件重新检索。' })
    await loadOrders(nextPage)
  }

  async function handlePageChange(nextPage: number) {
    setPage(nextPage)
    updateSearchParams(nextPage)
    await loadOrders(nextPage)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Orders"
        title="订单管理"
        description="查看套餐购买记录、支付状态和金额。当前环境下既可以看正式价，也可以用于测试价联调核对。"
        actions={
          <button
            type="button"
            onClick={() => loadOrders(page, '订单列表已刷新。')}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-archive-paper transition hover:border-archive-copper/35 hover:bg-archive-copper/10 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            刷新订单
          </button>
        }
      />

      {notice ? <NoticeBanner tone={notice.tone} message={notice.message} /> : null}

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
        <form className="grid gap-4 xl:grid-cols-[180px_220px_1fr_auto]" onSubmit={handleSearch}>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">状态</span>
            <input value={status} onChange={(event) => setStatus(event.target.value)} placeholder="如 mock_paid" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">套餐 ID</span>
            <input value={packageId} onChange={(event) => setPackageId(event.target.value)} placeholder="如 bundle_30" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">用户 ID</span>
            <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="按用户 ID 检索订单" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <button type="submit" className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-archive-copper px-5 text-sm font-semibold text-archive-ink transition hover:brightness-110">
            <Search className="h-4 w-4" />
            检索订单
          </button>
        </form>
      </section>

      <DataState loading={loading} error={error} empty={!loading && !error && orders.length === 0} emptyTitle="没有找到订单记录" emptyDescription="你可以按套餐 ID 或用户 ID 缩小范围，也可以先查看全部订单。" />

      {!loading && !error && orders.length > 0 ? (
        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] shadow-soft-panel">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left">
              <thead className="bg-white/[0.04] text-xs tracking-[0.24em] text-archive-paper/45 uppercase">
                <tr>
                  <th className="px-5 py-4">订单</th>
                  <th className="px-5 py-4">用户</th>
                  <th className="px-5 py-4">套餐</th>
                  <th className="px-5 py-4">金额 / 次数</th>
                  <th className="px-5 py-4">状态</th>
                  <th className="px-5 py-4">创建 / 支付</th>
                          <th className="px-5 py-4">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-sm text-archive-paper/80">
                {orders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">{order.title}</p>
                      <p className="mt-1 text-xs text-archive-mist">ID：{order.id}</p>
                    </td>
                    <td className="px-5 py-4 break-all text-xs text-archive-paper/70">{order.user_id}</td>
                    <td className="px-5 py-4">
                      <p>{order.package_id}</p>
                      <p className="mt-1 text-xs text-archive-mist">{order.payment_provider}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-display text-2xl text-archive-copper">{formatCurrency(order.price_cents)}</p>
                      <p className="mt-1 text-xs text-archive-mist">{order.credits} 次</p>
                    </td>
                    <td className="px-5 py-4"><StatusBadge value={order.status} label={order.status} /></td>
                    <td className="px-5 py-4">
                      <p>{formatDateTime(order.created_at)}</p>
                      <p className="mt-1 text-xs text-archive-mist">支付：{formatDateTime(order.paid_at)}</p>
                    </td>
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() => navigate(`/orders/${order.id}`)}
                                className="rounded-full border border-white/10 px-3 py-2 text-xs text-archive-paper/75 transition hover:border-white/20 hover:text-white"
                              >
                                详情页
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
        <PaginationBar page={page} pageSize={PAGE_SIZE} itemCount={orders.length} loading={loading} onPageChange={handlePageChange} />
      ) : null}
    </div>
  )
}
