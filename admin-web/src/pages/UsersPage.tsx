import { FormEvent, useEffect, useState } from 'react'
import { ArrowRightLeft, RefreshCw, Search, WalletCards } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { DataState } from '@/components/common/DataState'
import { DetailDrawer } from '@/components/common/DetailDrawer'
import { NoticeBanner } from '@/components/common/NoticeBanner'
import { PaginationBar } from '@/components/common/PaginationBar'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { CreditAdjustModal } from '@/components/users/CreditAdjustModal'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { AdminUser, adjustUserCredits, fetchUserDetail, fetchUsers, normalizeError } from '@/utils/api'
import { formatDateTime } from '@/utils/format'

const PAGE_SIZE = 10

export function UsersPage() {
  const navigate = useNavigate()
  const token = useAdminAuthStore((state) => state.token)
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [phone, setPhone] = useState(searchParams.get('phone') || '')
  const [nickname, setNickname] = useState(searchParams.get('nickname') || '')
  const [page, setPage] = useState(Number(searchParams.get('page') || '1'))
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  function updateSearchParams(nextPage: number) {
    setSearchParams({
      ...(phone ? { phone } : {}),
      ...(nickname ? { nickname } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {}),
    })
  }

  async function loadUsers(nextPage = page, successMessage?: string) {
    if (!token) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await fetchUsers(token, {
        phone,
        nickname,
        skip: (nextPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      })
      setUsers(result)
      if (successMessage) {
        setNotice({ tone: 'success', message: successMessage })
      }
    } catch (err) {
      const message = normalizeError(err, '用户列表加载失败')
      setError(message)
      if (successMessage) {
        setNotice({ tone: 'error', message })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [token])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextPage = 1
    setPage(nextPage)
    updateSearchParams(nextPage)
    setNotice({ tone: 'info', message: '已按新的用户条件重新检索。' })
    await loadUsers(nextPage)
  }

  async function handleAdjust(payload: { change: number; reason: string }) {
    if (!token || !selectedUser) {
      return
    }

    setSubmitting(true)
    try {
      await adjustUserCredits(token, selectedUser.id, payload)
      setSelectedUser(null)
      setNotice({ tone: 'success', message: '用户调账已完成。' })
      await loadUsers(page)
    } catch (err) {
      const message = normalizeError(err, '积分调账失败')
      setError(message)
      setNotice({ tone: 'error', message })
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePageChange(nextPage: number) {
    setPage(nextPage)
    updateSearchParams(nextPage)
    await loadUsers(nextPage)
  }

  async function handleOpenDetail(userId: string) {
    if (!token) {
      return
    }

    setLoadingDetail(true)
    try {
      const result = await fetchUserDetail(token, userId)
      setDetailUser(result)
    } catch (err) {
      setError(normalizeError(err, '用户详情加载失败'))
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Users"
        title="用户管理"
        description="从这里检索用户、核对余额，并对异常账户执行人工调账。所有调账都会自动进入积分流水与审计日志。"
        actions={
          <button
            type="button"
            onClick={() => loadUsers(page, '用户列表已刷新。')}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-archive-paper transition hover:border-archive-copper/35 hover:bg-archive-copper/10 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            刷新列表
          </button>
        }
      />

      {notice ? <NoticeBanner tone={notice.tone} message={notice.message} /> : null}

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
        <form className="grid gap-4 xl:grid-cols-[1fr_1fr_auto]" onSubmit={handleSearch}>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">手机号</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="按手机号模糊搜索" className="h-12 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none transition placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">昵称</span>
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="按昵称模糊搜索" className="h-12 w-full rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none transition placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <button type="submit" className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-archive-copper px-5 text-sm font-semibold text-archive-ink transition hover:brightness-110">
            <Search className="h-4 w-4" />
            检索用户
          </button>
        </form>
      </section>

      <DataState loading={loading} error={error} empty={!loading && !error && users.length === 0} emptyTitle="没有找到符合条件的用户" emptyDescription="可以尝试更换手机号或昵称关键词，或者先清空筛选条件再重试。" />

      {!loading && !error && users.length > 0 ? (
        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] shadow-soft-panel">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left">
              <thead className="bg-white/[0.04] text-xs tracking-[0.24em] text-archive-paper/45 uppercase">
                <tr>
                  <th className="px-5 py-4">用户</th>
                  <th className="px-5 py-4">手机号 / OpenID</th>
                  <th className="px-5 py-4">当前余额</th>
                  <th className="px-5 py-4">注册时间</th>
                  <th className="px-5 py-4">快捷入口</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-sm text-archive-paper/80">
                {users.map((user) => (
                  <tr key={user.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">{user.nickname || '未命名用户'}</p>
                      <p className="mt-1 text-xs text-archive-mist">ID：{user.id}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p>{user.phone || '未绑定手机号'}</p>
                      <p className="mt-1 truncate text-xs text-archive-mist">{user.openid || '无 openid'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="inline-flex items-center gap-2 rounded-full border border-archive-copper/35 bg-archive-copper/10 px-3 py-1 text-archive-copper">
                        <WalletCards className="h-4 w-4" />
                        <span className="font-semibold">{user.mileage_balance} 次</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">{formatDateTime(user.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setSelectedUser(user)} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white transition hover:border-archive-copper/35 hover:bg-archive-copper/10">
                          调账
                        </button>
                        <button type="button" onClick={() => handleOpenDetail(user.id)} className="rounded-full border border-white/10 px-3 py-2 text-xs text-archive-paper/75 transition hover:border-white/20 hover:text-white">
                          详情
                        </button>
                        <button type="button" onClick={() => navigate(`/tasks?user_id=${user.id}`)} className="rounded-full border border-white/10 px-3 py-2 text-xs text-archive-paper/75 transition hover:border-white/20 hover:text-white">
                          看任务
                        </button>
                        <button type="button" onClick={() => navigate(`/orders?user_id=${user.id}`)} className="rounded-full border border-white/10 px-3 py-2 text-xs text-archive-paper/75 transition hover:border-white/20 hover:text-white">
                          看订单
                        </button>
                        <button type="button" onClick={() => navigate(`/transactions?user_id=${user.id}`)} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-xs text-archive-paper/75 transition hover:border-white/20 hover:text-white">
                          看流水
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!loading && !error ? (
        <PaginationBar page={page} pageSize={PAGE_SIZE} itemCount={users.length} loading={loading} onPageChange={handlePageChange} />
      ) : null}

      <CreditAdjustModal
        open={!!selectedUser}
        user={selectedUser}
        submitting={submitting}
        onClose={() => setSelectedUser(null)}
        onSubmit={handleAdjust}
      />

      <DetailDrawer
        open={!!detailUser || loadingDetail}
        title={detailUser?.nickname || detailUser?.phone || '用户详情'}
        subtitle={detailUser ? `创建时间：${formatDateTime(detailUser.created_at)}` : '正在读取用户详情'}
        meta={detailUser ? <StatusBadge value="user" label={`${detailUser.mileage_balance} 次余额`} /> : null}
        onClose={() => setDetailUser(null)}
      >
        {loadingDetail && !detailUser ? (
          <DataState loading />
        ) : detailUser ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['用户 ID', detailUser.id],
              ['手机号', detailUser.phone || '未绑定手机号'],
              ['昵称', detailUser.nickname || '未命名用户'],
              ['OpenID', detailUser.openid || '无 openid'],
              ['UnionID', detailUser.unionid || '无 unionid'],
              ['头像地址', detailUser.avatar_url || '无头像地址'],
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
