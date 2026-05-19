import { FormEvent, useEffect, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { DataState } from '@/components/common/DataState'
import { NoticeBanner } from '@/components/common/NoticeBanner'
import { PaginationBar } from '@/components/common/PaginationBar'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { AdminTask, fetchTasks, normalizeError, retryTask } from '@/utils/api'
import { formatDateTime, prettifyTaskStatus } from '@/utils/format'

const PAGE_SIZE = 10

export function TasksPage() {
  const navigate = useNavigate()
  const token = useAdminAuthStore((state) => state.token)
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks, setTasks] = useState<AdminTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [taskType, setTaskType] = useState(searchParams.get('task_type') || '')
  const [userId, setUserId] = useState(searchParams.get('user_id') || '')
  const [page, setPage] = useState(Number(searchParams.get('page') || '1'))
  const [retryingTaskId, setRetryingTaskId] = useState('')

  function updateSearchParams(nextPage: number) {
    setSearchParams({
      ...(status ? { status } : {}),
      ...(taskType ? { task_type: taskType } : {}),
      ...(userId ? { user_id: userId } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {}),
    })
  }

  async function loadTasks(nextPage = page, successMessage?: string) {
    if (!token) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await fetchTasks(token, {
        status,
        task_type: taskType,
        user_id: userId,
        skip: (nextPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      })
      setTasks(result)
      if (successMessage) {
        setNotice({ tone: 'success', message: successMessage })
      }
    } catch (err) {
      const message = normalizeError(err, '任务列表加载失败')
      setError(message)
      if (successMessage) {
        setNotice({ tone: 'error', message })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [token])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextPage = 1
    setPage(nextPage)
    updateSearchParams(nextPage)
    setNotice({ tone: 'info', message: '已按新的任务条件重新检索。' })
    await loadTasks(nextPage)
  }

  async function handleRetry(taskId: string) {
    if (!token) {
      return
    }

    setRetryingTaskId(taskId)
    setError('')

    try {
      await retryTask(token, taskId)
      setNotice({ tone: 'success', message: '失败任务已重新提交。' })
      await loadTasks(page)
    } catch (err) {
      const message = normalizeError(err, '任务重试失败')
      setError(message)
      setNotice({ tone: 'error', message })
    } finally {
      setRetryingTaskId('')
    }
  }

  async function handlePageChange(nextPage: number) {
    setPage(nextPage)
    updateSearchParams(nextPage)
    await loadTasks(nextPage)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tasks"
        title="修复任务管理"
        description="集中查看任务状态、错误信息、原图与结果图。遇到失败任务时，可以在这里直接触发重试。"
        actions={
          <button
            type="button"
            onClick={() => loadTasks(page, '任务列表已刷新。')}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-archive-paper transition hover:border-archive-copper/35 hover:bg-archive-copper/10 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            刷新任务
          </button>
        }
      />

      {notice ? <NoticeBanner tone={notice.tone} message={notice.message} /> : null}

      <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
        <form className="grid gap-4 xl:grid-cols-[180px_220px_1fr_auto]" onSubmit={handleSearch}>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">状态</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none focus:border-archive-copper/40">
              <option value="">全部状态</option>
              <option value="pending">待处理</option>
              <option value="processing">处理中</option>
              <option value="completed">已完成</option>
              <option value="failed">已失败</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">任务类型</span>
            <input value={taskType} onChange={(event) => setTaskType(event.target.value)} placeholder="如 old_photo_enhance" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <label className="space-y-2">
            <span className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">用户 ID</span>
            <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="按用户 ID 筛选任务" className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-white outline-none placeholder:text-white/25 focus:border-archive-copper/40" />
          </label>
          <button type="submit" className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-archive-copper px-5 text-sm font-semibold text-archive-ink transition hover:brightness-110">
            <Search className="h-4 w-4" />
            筛选任务
          </button>
        </form>
      </section>

      <DataState loading={loading} error={error} empty={!loading && !error && tasks.length === 0} emptyTitle="没有匹配到任务" emptyDescription="你可以尝试按失败状态或指定用户 ID 重新检索。" />

      {!loading && !error && tasks.length > 0 ? (
        <section className="space-y-4">
          {tasks.map((task) => (
            <article key={task.task_id} className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge value={task.status} label={prettifyTaskStatus(task.status)} />
                    {task.task_type ? <StatusBadge value={task.task_type} label={task.task_type} /> : null}
                  </div>
                  <div>
                    <p className="text-sm text-archive-paper/55">任务 ID</p>
                    <p className="mt-1 break-all font-semibold text-white">{task.task_id}</p>
                  </div>
                  <div className="grid gap-2 text-sm text-archive-mist sm:grid-cols-2 xl:grid-cols-4">
                    <p>用户：{task.user_id || '—'}</p>
                    <p>风格：{task.style}</p>
                    <p>画幅：{task.aspect_ratio}</p>
                    <p>创建：{formatDateTime(task.created_at)}</p>
                  </div>
                </div>
                {task.status == 'failed' ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/tasks/${task.task_id}`)}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-archive-paper/75 transition hover:border-white/20 hover:text-white"
                    >
                      详情页
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRetry(task.task_id)}
                      disabled={retryingTaskId == task.task_id}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-archive-copper/35 bg-archive-copper/10 px-5 text-sm font-semibold text-archive-copper transition hover:bg-archive-copper/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw className={`h-4 w-4 ${retryingTaskId == task.task_id ? 'animate-spin' : ''}`} />
                      {retryingTaskId == task.task_id ? '重试中...' : '重试失败任务'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(`/tasks/${task.task_id}`)}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-archive-paper/75 transition hover:border-white/20 hover:text-white"
                  >
                    详情页
                  </button>
                )}
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                  <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">原图 / 结果图</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs text-archive-mist">原图</p>
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                        {task.reference_image_url ? <img src={task.reference_image_url} alt="参考图" className="h-40 w-full object-cover" /> : <div className="flex h-40 items-center justify-center text-xs text-archive-paper/40">无原图</div>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-archive-mist">结果图</p>
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                        {task.result_url ? <img src={task.result_url} alt="结果图" className="h-40 w-full object-cover" /> : <div className="flex h-40 items-center justify-center text-xs text-archive-paper/40">暂无结果图</div>}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                  <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">任务描述 / 错误信息</p>
                  <p className="mt-4 line-clamp-4 text-sm leading-7 text-archive-paper/80">{task.prompt}</p>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">进度 / 错误</p>
                    <p className="mt-3 text-sm text-white">当前进度：{task.progress}%</p>
                    <p className="mt-3 text-sm leading-7 text-archive-mist">{task.error_message || '当前没有错误信息。'}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {!loading && !error ? (
        <PaginationBar page={page} pageSize={PAGE_SIZE} itemCount={tasks.length} loading={loading} onPageChange={handlePageChange} />
      ) : null}

    </div>
  )
}
