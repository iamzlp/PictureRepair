import { useEffect, useState } from 'react'
import { Archive, Camera, DatabaseZap, ReceiptText, Ticket, Users2 } from 'lucide-react'

import { DataState } from '@/components/common/DataState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { AdminDashboardSummary, AdminSystemConfig, fetchDashboardSummary, fetchSystemConfig, normalizeError } from '@/utils/api'
import { formatCurrency, formatNumber } from '@/utils/format'

export function DashboardPage() {
  const token = useAdminAuthStore((state) => state.token)
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null)
  const [config, setConfig] = useState<AdminSystemConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      return
    }

    async function load() {
      setLoading(true)
      setError('')

      try {
        const [summaryResult, configResult] = await Promise.all([
          fetchDashboardSummary(token),
          fetchSystemConfig(token),
        ])
        setSummary(summaryResult)
        setConfig(configResult)
      } catch (err) {
        setError(normalizeError(err, '仪表盘数据加载失败'))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title="后台总览"
        description="把今天的用户、任务、充值和导出变化集中摆上修复台，先看全局，再决定从哪里介入。"
      />

      <DataState loading={loading} error={error} />

      {!loading && !error && summary && config ? (
        <>
          <section className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
            <StatCard label="总用户" value={formatNumber(summary.total_users)} hint="全量注册用户数" icon={<Users2 className="h-5 w-5" />} />
            <StatCard label="总任务" value={formatNumber(summary.total_tasks)} hint="累计修复任务数" accent="copper" icon={<Archive className="h-5 w-5" />} />
            <StatCard label="总订单" value={formatNumber(summary.total_orders)} hint="累计充值订单数" accent="rose" icon={<ReceiptText className="h-5 w-5" />} />
            <StatCard label="总流水" value={formatNumber(summary.total_transactions)} hint="包括购买、导出和调账" icon={<Ticket className="h-5 w-5" />} />
            <StatCard label="完成任务" value={formatNumber(summary.completed_tasks)} hint="可下载结果图的任务" accent="copper" icon={<Camera className="h-5 w-5" />} />
            <StatCard label="失败任务" value={formatNumber(summary.failed_tasks)} hint="建议进入任务页继续排查" accent="rose" icon={<DatabaseZap className="h-5 w-5" />} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-soft-panel">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs tracking-[0.28em] text-archive-paper/45 uppercase">今日数据</p>
                  <h3 className="mt-2 font-display text-3xl text-white">运行快照</h3>
                </div>
                <StatusBadge value={summary.failed_tasks > 0 ? 'failed' : 'completed'} label={summary.failed_tasks > 0 ? '有待排查' : '状态平稳'} />
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[
                  ['今日新增用户', formatNumber(summary.today_new_users), '新进入小程序的用户'],
                  ['今日修复任务', formatNumber(summary.today_tasks), '今日提交到修复链路的任务'],
                  ['今日导出次数', formatNumber(summary.today_exports), '今日成功导出的修复结果'],
                  ['今日订单数', formatNumber(summary.today_orders), '今日充值单量'],
                ].map(([label, value, desc]) => (
                  <div key={label} className="rounded-[24px] border border-white/10 bg-black/10 p-5">
                    <p className="text-sm text-archive-mist">{label}</p>
                    <p className="mt-4 font-display text-4xl text-white">{value}</p>
                    <p className="mt-2 text-xs leading-6 text-archive-paper/55">{desc}</p>
                  </div>
                ))}
                <div className="rounded-[24px] border border-archive-copper/30 bg-archive-copper/10 p-5 md:col-span-2">
                  <p className="text-sm text-archive-paper/75">今日收入</p>
                  <p className="mt-4 font-display text-5xl text-white">{formatCurrency(summary.today_revenue_cents)}</p>
                  <p className="mt-2 text-xs leading-6 text-archive-paper/55">当前数据包含 mock 充值和测试价环境，请结合系统状态区一起判断。</p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-soft-panel">
              <div className="border-b border-white/10 pb-5">
                <p className="text-xs tracking-[0.28em] text-archive-paper/45 uppercase">系统状态</p>
                <h3 className="mt-2 font-display text-3xl text-white">当前生效配置</h3>
              </div>
              <div className="mt-6 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
                    <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">图片生成</p>
                    <div className="mt-3"><StatusBadge value={config.mock_image_generation} label={config.mock_image_generation ? 'Mock 开启' : '真实生成'} /></div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
                    <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">微信登录</p>
                    <div className="mt-3"><StatusBadge value={config.mock_wechat_login} label={config.mock_wechat_login ? 'Mock 开启' : '真实登录'} /></div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
                    <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">测试价</p>
                    <div className="mt-3"><StatusBadge value={config.payment_use_test_prices} label={config.payment_use_test_prices ? '测试价生效' : '正式价'} /></div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
                    <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">模型 / 存储</p>
                    <p className="mt-3 text-sm text-white">{config.image_model} / {config.storage_type}</p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-black/10 p-5">
                  <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">当前套餐</p>
                  <div className="mt-4 grid gap-3">
                    {config.packages.map((pkg) => (
                      <div key={pkg.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{pkg.title}</p>
                          <p className="mt-1 text-xs text-archive-mist">{pkg.credits} 次额度</p>
                        </div>
                        <p className="font-display text-2xl text-archive-copper">{formatCurrency(pkg.price_cents)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
