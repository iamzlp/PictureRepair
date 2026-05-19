import { describe, expect, it } from 'vitest'

import {
  formatCurrency,
  formatDateTime,
  prettifyAction,
  prettifyTargetType,
  prettifyTaskStatus,
} from '@/utils/format'

describe('format helpers', () => {
  it('formats cents into yuan', () => {
    expect(formatCurrency(299)).toBe('¥2.99')
  })

  it('formats ISO datetime into readable chinese text', () => {
    expect(formatDateTime('2026-05-17T14:12:48.000Z')).toContain('2026')
  })

  it('maps known task status labels', () => {
    expect(prettifyTaskStatus('failed')).toBe('已失败')
  })

  it('maps known audit actions and target types', () => {
    expect(prettifyAction('retry_task')).toBe('重试任务')
    expect(prettifyTargetType('user')).toBe('用户')
  })
})
