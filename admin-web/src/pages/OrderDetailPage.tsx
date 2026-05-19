import { useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { DataState } from '@/components/common/DataState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { AdminOrder, fetchOrderDetail, normalizeError } from '@/utils/api'
import { formatCurrency, formatDateTime } from '@/utils/format'

export function OrderDetailPage() {
  const navigate = useNavigate()
  const { orderId = '' } = useParams()
  const token = useAdminAuthStore((state) => state.token)
  const [order, setOrder] = useState<AdminOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadOrderDetail() {
    if (!token || !orderId) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await fetchOrderDetail(token, orderId)
      setOrder(result)
    } catch (err) {
      setError(normalizeError(err, '订单详情加载失败'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrderDetail()
  }, [token, orderId])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Order Detail"
        title={order?.title || '订单详情页'}
        description={order ? `订单 ID：${order.id}` : '查看单个订单的金额、套餐、支付状态与关联用户。'}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-archive-paper transition hover:border-white/20 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              返回订单列表
            </button>
            <button
              type="button"
              onClick={() => loadOrderDetail()}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-archive-paper transition hover:border-archive-copper/35 hover:bg-archive-copper/10 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新详情
            </button>
          </>
        }
      />

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && !order}
        emptyTitle="没有找到订单详情"
        emptyDescription="这个订单可能已不存在，或者当前管理员没有访问权限。"
      />

      {!loading && !error && order ? (
        <>
          <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge value={order.status} label={order.status} />
                  <StatusBadge value={order.package_id} label={order.package_id} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['订单 ID', order.id],
                    ['用户 ID', order.user_id],
                    ['套餐 ID', order.package_id],
                    ['订单标题', order.title],
                    ['支付渠道', order.payment_provider],
                    ['渠道单号', order.provider_trade_no || '—'],
                    ['创建时间', formatDateTime(order.created_at)],
                    ['支付时间', formatDateTime(order.paid_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                      <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">{label}</p>
                      <p className="mt-3 break-all text-sm leading-7 text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-black/10 p-5 xl:w-[260px]">
                <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">订单概览</p>
                <p className="mt-4 font-display text-5xl text-archive-copper">{formatCurrency(order.price_cents)}</p>
                <p className="mt-2 text-sm text-archive-mist">支付金额</p>
                <p className="mt-4 text-sm text-white">{order.credits} 次</p>
                <p className="mt-1 text-xs text-archive-paper/45">购买次数</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    to={`/orders?user_id=${order.user_id}`}
                    className="inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-archive-paper/75 transition hover:border-white/20 hover:text-white"
                  >
                    查看该用户订单
                  </Link>
                  <Link
                    to={`/transactions?reference_id=${order.id}`}
                    className="inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-archive-paper/75 transition hover:border-white/20 hover:text-white"
                  >
                    查看关联流水
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
              <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">金额信息</p>
              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                  <p className="text-sm text-archive-mist">订单金额</p>
                  <p className="mt-2 font-display text-4xl text-white">{formatCurrency(order.price_cents)}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                  <p className="text-sm text-archive-mist">套餐次数</p>
                  <p className="mt-2 font-display text-4xl text-white">{order.credits}</p>
                </div>
              </div>
            </div>
            <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
              <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">支付状态</p>
              <div className="mt-4 rounded-[24px] border border-white/10 bg-black/10 p-4">
                <StatusBadge value={order.status} label={order.status} />
                <p className="mt-4 text-sm leading-7 text-archive-paper/80">
                  当前订单通过 {order.payment_provider} 渠道创建，支付时间为 {formatDateTime(order.paid_at)}。
                </p>
              </div>
            </div>
            <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
              <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">关联用户</p>
              <div className="mt-4 rounded-[24px] border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-archive-mist">用户 ID</p>
                <p className="mt-2 break-all text-sm leading-7 text-white">{order.user_id}</p>
                <div className="mt-5">
                  <Link
                    to={`/transactions?user_id=${order.user_id}`}
                    className="inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-archive-paper/75 transition hover:border-white/20 hover:text-white"
                  >
                    查看该用户全部流水
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
