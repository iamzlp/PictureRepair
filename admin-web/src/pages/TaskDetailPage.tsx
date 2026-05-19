import { useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { DataState } from '@/components/common/DataState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { AdminTask, fetchTaskDetail, normalizeError, retryTask } from '@/utils/api'
import { formatDateTime, prettifyTaskStatus } from '@/utils/format'

export function TaskDetailPage() {
  const navigate = useNavigate()
  const { taskId = '' } = useParams()
  const token = useAdminAuthStore((state) => state.token)
  const [task, setTask] = useState<AdminTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)

  async function loadTaskDetail() {
    if (!token || !taskId) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await fetchTaskDetail(token, taskId)
      setTask(result)
    } catch (err) {
      setError(normalizeError(err, '任务详情加载失败'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTaskDetail()
  }, [token, taskId])

  async function handleRetry() {
    if (!token || !task) {
      return
    }

    setRetrying(true)
    setError('')

    try {
      await retryTask(token, task.task_id)
      await loadTaskDetail()
    } catch (err) {
      setError(normalizeError(err, '任务重试失败'))
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Task Detail"
        title={task?.task_type || '任务详情页'}
        description={task ? `任务 ID：${task.task_id}` : '查看单个修复任务的完整状态、图像结果和错误信息。'}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-archive-paper transition hover:border-white/20 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              返回任务列表
            </button>
            <button
              type="button"
              onClick={() => loadTaskDetail()}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-archive-paper transition hover:border-archive-copper/35 hover:bg-archive-copper/10 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新详情
            </button>
            {task?.status == 'failed' ? (
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-archive-copper/35 bg-archive-copper/10 px-4 text-sm font-semibold text-archive-copper transition hover:bg-archive-copper/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? '重试中...' : '重试失败任务'}
              </button>
            ) : null}
          </>
        }
      />

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && !task}
        emptyTitle="没有找到任务详情"
        emptyDescription="这个任务可能已不存在，或者当前管理员没有访问权限。"
      />

      {!loading && !error && task ? (
        <>
          <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge value={task.status} label={prettifyTaskStatus(task.status)} />
                  {task.task_type ? <StatusBadge value={task.task_type} label={task.task_type} /> : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['任务 ID', task.task_id],
                    ['用户 ID', task.user_id || '—'],
                    ['批次 ID', task.batch_id || '—'],
                    ['外部任务 ID', task.external_task_id || '—'],
                    ['风格', task.style],
                    ['画幅', task.aspect_ratio],
                    ['创建时间', formatDateTime(task.created_at)],
                    ['更新时间', formatDateTime(task.updated_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                      <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">{label}</p>
                      <p className="mt-3 break-all text-sm leading-7 text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-black/10 p-5 xl:w-[260px]">
                <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">执行概览</p>
                <p className="mt-4 font-display text-5xl text-archive-copper">{task.progress}%</p>
                <p className="mt-2 text-sm text-archive-mist">当前进度</p>
                {task.user_id ? (
                  <Link
                    to={`/tasks?user_id=${task.user_id}`}
                    className="mt-5 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-archive-paper/75 transition hover:border-white/20 hover:text-white"
                  >
                    查看该用户任务
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
              <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">原图</p>
              <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
                {task.reference_image_url ? (
                  <img src={task.reference_image_url} alt="任务原图" className="h-[420px] w-full object-cover" />
                ) : (
                  <div className="flex h-[420px] items-center justify-center text-sm text-archive-paper/40">无原图</div>
                )}
              </div>
            </div>
            <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
              <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">结果图</p>
              <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
                {task.result_url ? (
                  <img src={task.result_url} alt="任务结果图" className="h-[420px] w-full object-cover" />
                ) : (
                  <div className="flex h-[420px] items-center justify-center text-sm text-archive-paper/40">暂无结果图</div>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
              <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">任务描述</p>
              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-8 text-white">{task.prompt}</p>
            </div>
            <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-soft-panel">
              <p className="text-xs tracking-[0.24em] text-archive-paper/40 uppercase">错误信息</p>
              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-8 text-archive-paper/80">
                {task.error_message || '当前没有错误信息。'}
              </p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
