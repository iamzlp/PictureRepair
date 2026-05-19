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
  return `${y}.${m}.${day}`
}

Page({
  data: {
    taskId: '',
    sourceUrl: '',
    resultUrl: '',
    dateText: '',
    exporting: false
  },

  async onShow() {
    const tabbar = this.getTabBar && this.getTabBar()
    if (tabbar && tabbar.setData) {
      tabbar.setData({ selected: 1 })
    }
    await this.resumePendingExport()
  },

  onLoad(query) {
    const taskId = query && query.taskId ? String(query.taskId) : ''
    this.setData({ taskId })
    if (!auth.getToken()) {
      auth.navigateToLogin({ back: 1 })
      return
    }
    this.loadTask()
  },

  async loadTask() {
    if (!this.data.taskId) return
    try {
      const task = await api.getRepairTask(this.data.taskId)
      this.setData({
        sourceUrl: task.reference_image_url || '',
        resultUrl: task.result_url || '',
        dateText: formatDate(task.created_at) || ''
      })
    } catch (error) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  onPreviewAfter() {
    if (!this.data.resultUrl) return
    wx.previewImage({
      urls: [this.data.resultUrl],
      current: this.data.resultUrl
    })
  },

  onPreviewBefore() {
    if (!this.data.sourceUrl) return
    wx.previewImage({
      urls: [this.data.sourceUrl],
      current: this.data.sourceUrl
    })
  },

  async onDownload() {
    if (!this.data.taskId || this.data.exporting) return
    if (!auth.getToken()) {
      auth.navigateToLogin({ back: 1 })
      return
    }
    this.setData({ exporting: true })
    try {
      const result = await api.exportRepairTask(this.data.taskId)
      wx.previewImage({
        urls: [result.result_url],
        current: result.result_url
      })
    } catch (error) {
      if (String(error.message).includes('Insufficient')) {
        wx.navigateTo({ url: `/pages/personal-centre/recharge?from=export&source=view-photos&taskId=${encodeURIComponent(this.data.taskId)}` })
        return
      }
      wx.showToast({ title: error.message || '下载失败', icon: 'none' })
    } finally {
      this.setData({ exporting: false })
    }
  },

  async resumePendingExport() {
    const pending = exportFlow.consumePendingExportAction('view-photos', this.data.taskId)
    if (!pending) return
    await this.onDownload()
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/repair-record/index' })
  }
})

