import {
  ActivitySquare,
  BadgeDollarSign,
  FileClock,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShieldCheck,
  Tickets,
  Users,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { useAdminAuthStore } from '@/stores/adminAuthStore'

const navigation = [
  { to: '/dashboard', label: '仪表盘', icon: LayoutDashboard, note: '今日概览' },
  { to: '/users', label: '用户管理', icon: Users, note: '余额与用户画像' },
  { to: '/tasks', label: '修复任务', icon: ActivitySquare, note: '状态与失败重试' },
  { to: '/orders', label: '订单管理', icon: BadgeDollarSign, note: '支付与套餐记录' },
  { to: '/transactions', label: '积分流水', icon: Tickets, note: '购买/导出/调账' },
  { to: '/audit-logs', label: '审计日志', icon: FileClock, note: '管理员操作痕迹' },
  { to: '/system-config', label: '系统配置', icon: Settings2, note: 'mock 与测试价' },
]

export function AdminShell() {
  const location = useLocation()
  const admin = useAdminAuthStore((state) => state.admin)
  const clearSession = useAdminAuthStore((state) => state.clearSession)

  return (
    <div className="min-h-screen bg-archive-ink text-archive-paper">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(184,131,88,0.18),_transparent_35%),linear-gradient(180deg,rgba(8,10,14,0.94),rgba(8,10,14,1))]" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px] opacity-20" />
      <div className="relative flex min-h-screen">
        <aside className="hidden w-[308px] flex-col border-r border-white/10 bg-black/20 px-6 py-8 backdrop-blur xl:flex">
          <div className="mb-10 space-y-4 rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-soft-glow">
            <div className="inline-flex items-center gap-2 rounded-full border border-archive-copper/40 bg-archive-copper/10 px-3 py-1 text-[11px] tracking-[0.3em] text-archive-copper uppercase">
              <ShieldCheck className="h-3.5 w-3.5" />
              内部管理台
            </div>
            <div>
              <p className="font-display text-3xl text-archive-paper">老照片修复后台</p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-archive-mist">
                以档案修复台的视角管理用户、任务、订单和每一次次数变动。
              </p>
            </div>
          </div>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-4 rounded-[24px] border px-4 py-4 transition-all duration-300',
                      isActive
                        ? 'border-archive-copper/50 bg-archive-copper/12 text-white shadow-soft-glow'
                        : 'border-white/6 bg-white/[0.03] text-archive-mist hover:border-white/15 hover:bg-white/[0.06] hover:text-white'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors',
                          isActive ? 'border-archive-copper/60 bg-archive-copper/15 text-archive-copper' : 'border-white/10 bg-black/10'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="flex-1">
                        <span className="block font-body text-sm font-semibold tracking-[0.18em] uppercase">{item.label}</span>
                        <span className="mt-1 block text-xs text-white/50">{item.note}</span>
                      </span>
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-auto rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs tracking-[0.3em] text-archive-paper/45 uppercase">当前管理员</p>
            <p className="mt-3 font-display text-2xl text-white">{admin?.username ?? '未登录'}</p>
            <p className="mt-1 text-sm text-archive-mist">角色：{admin?.role ?? '-'}</p>
            <button
              type="button"
              onClick={clearSession}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-archive-paper transition hover:border-archive-copper/40 hover:bg-archive-copper/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-black/15 px-5 py-4 backdrop-blur xl:px-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.3em] text-archive-paper/45 uppercase">档案修复指挥台</p>
                <h1 className="mt-1 font-display text-2xl text-white xl:text-3xl">
                  {navigation.find((item) => location.pathname.startsWith(item.to))?.label ?? '后台管理'}
                </h1>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-right text-xs text-archive-mist">
                <p>环境：本地联调</p>
                <p className="mt-1">状态：可操作</p>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 xl:px-10 xl:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
