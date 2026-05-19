export function formatDateTime(value?: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatCurrency(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

export function prettifyTaskStatus(status: string) {
  const map: Record<string, string> = {
    pending: '待处理',
    submitted: '已提交',
    processing: '处理中',
    downloading: '转存中',
    completed: '已完成',
    failed: '已失败',
  }
  return map[status] ?? status
}

export function prettifyAction(action: string) {
  const map: Record<string, string> = {
    retry_task: '重试任务',
    adjust_user_credits: '积分调账',
  }
  return map[action] ?? action
}

export function prettifyTargetType(targetType: string) {
  const map: Record<string, string> = {
    user: '用户',
    task: '任务',
  }
  return map[targetType] ?? targetType
}
