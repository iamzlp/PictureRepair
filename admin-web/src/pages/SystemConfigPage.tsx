import { useEffect, useState } from 'react'

import { DataState } from '@/components/common/DataState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { AdminSystemConfig, fetchSystemConfig, normalizeError } from '@/utils/api'
import { formatCurrency } from '@/utils/format'

export function SystemConfigPage() {
  const token = useAdminAuthStore((state) => state.token)
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
        const result = await fetchSystemConfig(token)
        setConfig(result)
      } catch (err) {
        setError(normalizeError(err, '系统配置加载失败'))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Config"
        title="系统配置"
        description="这里不是改配置，而是确认当前环境究竟跑在哪一套模式上，避免联调时“以为是真实环境，其实是 mock”。"
      />

      <DataState loading={loading} error={error} />

      {!loading && !error && config ? (
        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-soft-panel">
            <div className="border-b border-white/10 pb-5">
              <p className="text-xs tracking-[0.28em] text-archive-paper/45 uppercase">环境状态</p>
              <h3 className="mt-2 font-display text-3xl text-white">当前开关</h3>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-archive-mist">图片生成</p>
                <div className="mt-3"><StatusBadge value={config.mock_image_generation} label={config.mock_image_generation ? 'Mock 开启' : '真实生成'} /></div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-archive-mist">微信登录</p>
                <div className="mt-3"><StatusBadge value={config.mock_wechat_login} label={config.mock_wechat_login ? 'Mock 开启' : '真实登录'} /></div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-archive-mist">测试价</p>
                <div className="mt-3"><StatusBadge value={config.payment_use_test_prices} label={config.payment_use_test_prices ? '测试价生效' : '正式价'} /></div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-archive-mist">模型 / 存储</p>
                <p className="mt-3 text-lg font-semibold text-white">{config.image_model} / {config.storage_type}</p>
              </div>
            </div>
            <div className="mt-6 rounded-[24px] border border-white/10 bg-black/10 p-4 text-sm leading-7 text-archive-mist">
              <p>测试分价：</p>
              <p className="mt-3">single_1 = {formatCurrency(config.payment_test_price_single_1_cents)}</p>
              <p>bundle_30 = {formatCurrency(config.payment_test_price_bundle_30_cents)}</p>
              <p>bundle_90 = {formatCurrency(config.payment_test_price_bundle_90_cents)}</p>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-soft-panel">
            <div className="border-b border-white/10 pb-5">
              <p className="text-xs tracking-[0.28em] text-archive-paper/45 uppercase">套餐映射</p>
              <h3 className="mt-2 font-display text-3xl text-white">当前生效套餐</h3>
            </div>
            <div className="mt-6 grid gap-4">
              {config.packages.map((pkg) => (
                <article key={pkg.id} className="rounded-[28px] border border-white/10 bg-black/10 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">{pkg.id}</p>
                      <h4 className="mt-2 font-display text-3xl text-white">{pkg.title}</h4>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-4xl text-archive-copper">{formatCurrency(pkg.price_cents)}</p>
                      <p className="mt-1 text-sm text-archive-mist">{pkg.credits} 次</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
