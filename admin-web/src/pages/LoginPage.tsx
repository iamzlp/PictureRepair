import { FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { KeyRound, Landmark, ShieldCheck } from 'lucide-react'

import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { loginAdmin, normalizeError } from '@/utils/api'

export function LoginPage() {
  const navigate = useNavigate()
  const token = useAdminAuthStore((state) => state.token)
  const admin = useAdminAuthStore((state) => state.admin)
  const setSession = useAdminAuthStore((state) => state.setSession)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('Admin123456')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (token && admin) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await loginAdmin({ username, password })
      setSession({ token: result.access_token, admin: result.admin })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(normalizeError(err, '登录失败，请检查管理员账号和密码'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-archive-ink text-archive-paper">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(184,131,88,0.24),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(145,122,134,0.2),_transparent_30%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-8 self-stretch rounded-[40px] border border-white/10 bg-white/[0.04] p-8 shadow-soft-glow lg:p-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-archive-copper/35 bg-archive-copper/10 px-4 py-2 text-xs tracking-[0.3em] text-archive-copper uppercase">
              <Landmark className="h-4 w-4" />
              档案修复指挥台
            </div>
            <div className="space-y-5">
              <p className="font-display text-5xl leading-tight text-white lg:text-7xl">后台管理入口</p>
              <p className="max-w-2xl text-base leading-8 text-archive-mist lg:text-lg">
                面向运营、客服与排障人员的内部控制台，用一张桌面追踪用户、任务、订单、流水与每一次人为修正。
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['失败任务重试', '集中定位修复链路异常，并触发失败任务重跑。'],
                ['积分补偿留痕', '每次调账都同步记录流水和管理员审计日志。'],
                ['配置状态可视', '一眼看到 mock 开关、测试价和当前套餐配置。'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-[28px] border border-white/10 bg-black/10 p-5">
                  <p className="font-semibold text-white">{title}</p>
                  <p className="mt-3 text-sm leading-7 text-archive-mist">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[40px] border border-white/10 bg-archive-panel/95 p-8 shadow-soft-panel lg:p-10">
            <div className="space-y-4 border-b border-white/10 pb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-archive-copper/35 bg-archive-copper/10 text-archive-copper">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs tracking-[0.35em] text-archive-paper/40 uppercase">管理员认证</p>
                <h1 className="mt-2 font-display text-4xl text-white">登录后台</h1>
                <p className="mt-3 text-sm leading-7 text-archive-mist">使用管理员账号进入后台。当前本地默认管理员账号已自动填充，便于联调。</p>
              </div>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-xs tracking-[0.28em] text-archive-paper/45 uppercase">用户名</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-black/15 px-5 text-white outline-none transition placeholder:text-white/25 focus:border-archive-copper/45"
                  placeholder="请输入管理员用户名"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs tracking-[0.28em] text-archive-paper/45 uppercase">密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-black/15 px-5 text-white outline-none transition placeholder:text-white/25 focus:border-archive-copper/45"
                  placeholder="请输入管理员密码"
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-archive-rose/35 bg-archive-rose/10 px-4 py-3 text-sm text-archive-paper">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-archive-copper px-5 font-semibold text-archive-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <KeyRound className="h-5 w-5" />
                {loading ? '正在验证管理员身份...' : '进入后台'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
