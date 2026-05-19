const api = require('../../utils/api')
const auth = require('../../utils/auth')
const exportFlow = require('../../utils/export-flow')

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function modeTextFromTask(task) {
  const t = String(task.task_type || '')
  if (t.includes('colorize')) return '黑白上色'
  if (t.includes('enhance')) return '画质增强'
  return '照片修复'
}

function isDisabledFlag(value) {
  return value === true || value === 'true'
}

Page({
  data: {
    loading: false,
    tasks: []
  },

  async onShow() {
    const tabbar = this.getTabBar && this.getTabBar()
    if (tabbar && tabbar.setData) {
      tabbar.setData({ selected: 1 })
    }
    try {
      await auth.ensureSession()
    } catch (error) {
      auth.navigateToLogin({ tab: '/pages/repair-record/index' })
      return
    }
    await this.resumePendingExport()
    this.loadTasks()
  },

  onPullDownRefresh() {
    this.loadTasks().finally(() => wx.stopPullDownRefresh())
  },

  async loadTasks() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const tasks = await api.listTasks({ skip: 0, limit: 50 })
      const mapped = (tasks || []).map((t) => {
        const status = t.status
        const progress = typeof t.progress === 'number' ? t.progress : 0
        const statusText = status === 'processing' ? `处理中 (${progress}%)` : (status === 'completed' ? '已完成' : (status === 'failed' ? '处理失败' : '处理中'))
        return {
          ...t,
          dateText: formatDate(t.created_at) || '今天',
          statusText,
          modeText: modeTextFromTask(t)
        }
      })
      this.setData({ tasks: mapped })
    } catch (error) {
      this.setData({ tasks: [] })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  async onView(event) {
    if (isDisabledFlag(event.currentTarget.dataset.disabled)) return
    const taskId = event.currentTarget.dataset.id
    if (!taskId) return
    try {
      await auth.ensureSession()
    } catch (error) {
      auth.navigateToLogin({ back: 1 })
      return
    }
    wx.navigateTo({ url: `/pages/repair-record/view-photos?taskId=${encodeURIComponent(taskId)}` })
  },

  async onDownload(event) {
    if (isDisabledFlag(event.currentTarget.dataset.disabled)) return
    const taskId = event.currentTarget.dataset.id
    if (!taskId) return
    try {
      await auth.ensureSession()
    } catch (error) {
      auth.navigateToLogin({ back: 1 })
      return
    }
    try {
      const result = await api.exportRepairTask(taskId)
      wx.previewImage({
        urls: [result.result_url],
        current: result.result_url
      })
    } catch (error) {
      if (String(error.message).includes('Insufficient')) {
        wx.navigateTo({ url: `/pages/personal-centre/recharge?from=export&source=repair-record&taskId=${encodeURIComponent(taskId)}` })
        return
      }
      wx.showToast({ title: error.message || '下载失败', icon: 'none' })
    }
  },

  async resumePendingExport() {
    const pending = exportFlow.consumePendingExportAction('repair-record')
    if (!pending || !pending.taskId) return
    try {
      const result = await api.exportRepairTask(pending.taskId)
      wx.previewImage({
        urls: [result.result_url],
        current: result.result_url
      })
    } catch (error) {
      wx.showToast({ title: error.message || '下载失败', icon: 'none' })
    }
  }
})

