import { FormEvent, useEffect, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'

import type { AdminUser } from '@/utils/api'

type CreditAdjustModalProps = {
  open: boolean
  user: AdminUser | null
  submitting: boolean
  onClose: () => void
  onSubmit: (payload: { change: number; reason: string }) => Promise<void>
}

export function CreditAdjustModal({ open, user, submitting, onClose, onSubmit }: CreditAdjustModalProps) {
  const [change, setChange] = useState(1)
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState<'add' | 'subtract'>('add')

  useEffect(() => {
    if (!open) {
      setChange(1)
      setReason('')
      setMode('add')
    }
  }, [open])

  if (!open || !user) {
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const finalChange = mode == 'add' ? Math.abs(change) : -Math.abs(change)
    await onSubmit({ change: finalChange, reason })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[32px] border border-white/12 bg-archive-panel p-6 shadow-soft-glow">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs tracking-[0.3em] text-archive-paper/45 uppercase">积分调账</p>
            <h3 className="mt-2 font-display text-3xl text-white">{user.nickname || user.phone || user.id}</h3>
            <p className="mt-2 text-sm text-archive-mist">当前余额：{user.mileage_balance} 次</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-archive-paper/70 transition hover:border-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`rounded-[24px] border p-4 text-left transition ${
                mode == 'add'
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-white'
                  : 'border-white/10 bg-white/[0.03] text-archive-paper/75 hover:border-white/20'
              }`}
            >
              <Plus className="h-5 w-5" />
              <p className="mt-4 text-lg font-semibold">增加次数</p>
              <p className="mt-1 text-sm text-archive-mist">用于补偿、赠送或人工修复余额</p>
            </button>
            <button
              type="button"
              onClick={() => setMode('subtract')}
              className={`rounded-[24px] border p-4 text-left transition ${
                mode == 'subtract'
                  ? 'border-rose-400/40 bg-rose-400/10 text-white'
                  : 'border-white/10 bg-white/[0.03] text-archive-paper/75 hover:border-white/20'
              }`}
            >
              <Minus className="h-5 w-5" />
              <p className="mt-4 text-lg font-semibold">扣减次数</p>
              <p className="mt-1 text-sm text-archive-mist">用于回滚异常补偿或人工修正余额</p>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <label className="space-y-2">
              <span className="text-xs tracking-[0.24em] text-archive-paper/50 uppercase">次数变动</span>
              <input
                type="number"
                min={1}
                value={change}
                onChange={(event) => setChange(Number(event.target.value || 1))}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/15 px-4 text-white outline-none transition focus:border-archive-copper/40"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs tracking-[0.24em] text-archive-paper/50 uppercase">原因说明</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="例如：补偿失败重试、客服人工修正"
                required
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/15 px-4 text-white outline-none transition placeholder:text-white/25 focus:border-archive-copper/40"
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 px-5 py-3 text-sm text-archive-paper/75 transition hover:border-white/20 hover:text-white"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-archive-copper px-5 py-3 text-sm font-semibold text-archive-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? '提交中...' : '确认调账'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
