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
    videoUrl: '',
    videoStatus: '',
    videoProgress: 0,
    videoErrorMessage: '',
    dateText: '',
    exporting: false,
    generatingVideo: false,
    downloadingVideo: false
  },

  pollTimer: null,

  async onShow() {
    const tabbar = this.getTabBar && this.getTabBar()
    if (tabbar && tabbar.setData) {
      tabbar.setData({ selected: 1 })
    }
    if (this.data.taskId) {
      await this.loadTask()
    }
    await this.resumePendingExport()
    await this.resumePendingVideo()
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

  onUnload() {
    this.stopVideoPolling()
  },

  onHide() {
    this.stopVideoPolling()
  },

  async loadTask() {
    if (!this.data.taskId) return
    try {
      const task = await api.getRepairTask(this.data.taskId)
      this.setData({
        sourceUrl: task.reference_image_url || '',
        resultUrl: task.result_url || '',
        videoUrl: task.result_video_url || '',
        videoStatus: task.video_status || '',
        videoProgress: typeof task.video_progress === 'number' ? task.video_progress : 0,
        videoErrorMessage: task.video_error_message || '',
        dateText: formatDate(task.created_at) || ''
      })
      this.updateVideoPolling(task.video_status)
      return task
    } catch (error) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
      return null
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

  async resumePendingVideo() {
    const pending = exportFlow.consumePendingExportAction('view-photos', this.data.taskId, 'video')
    if (!pending) return
    await this.onGenerateVideo()
  },

  stopVideoPolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
  },

  updateVideoPolling(status) {
    const normalized = String(status || '')
    if (normalized === 'submitted' || normalized === 'processing') {
      this.scheduleVideoPolling()
      return
    }
    this.stopVideoPolling()
  },

  scheduleVideoPolling() {
    this.stopVideoPolling()
    this.pollTimer = setTimeout(async () => {
      const task = await this.loadTask()
      if (task && (task.video_status === 'submitted' || task.video_status === 'processing')) {
        this.scheduleVideoPolling()
      }
    }, 4000)
  },

  async onGenerateVideo() {
    if (!this.data.taskId || this.data.generatingVideo) return
    if (!auth.getToken()) {
      auth.navigateToLogin({ back: 1 })
      return
    }
    const isRegenerate = this.data.videoStatus === 'completed'
    this.setData({ generatingVideo: true })
    try {
      const task = await api.createRepairVideo(this.data.taskId)
      this.setData({
        videoUrl: task.result_video_url || '',
        videoStatus: task.video_status || '',
        videoProgress: typeof task.video_progress === 'number' ? task.video_progress : 0,
        videoErrorMessage: task.video_error_message || ''
      })
      this.updateVideoPolling(task.video_status)
      wx.showToast({ title: isRegenerate ? '重新生成任务已提交' : '视频任务已提交', icon: 'success' })
    } catch (error) {
      if (String(error.message).includes('Insufficient')) {
        wx.navigateTo({ url: `/pages/personal-centre/recharge?from=video&source=view-photos&taskId=${encodeURIComponent(this.data.taskId)}` })
        return
      }
      wx.showToast({ title: error.message || '生成视频失败', icon: 'none' })
    } finally {
      this.setData({ generatingVideo: false })
    }
  },

  async onDownloadVideo() {
    if (!this.data.taskId || this.data.downloadingVideo || !this.data.videoUrl) return
    this.setData({ downloadingVideo: true })
    try {
      const task = await this.loadTask()
      const videoUrl = (task && task.result_video_url) || this.data.videoUrl
      if (!videoUrl) {
        throw new Error('视频尚未生成完成')
      }
      const downloadResult = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: videoUrl,
          success: resolve,
          fail: reject
        })
      })
      if (!downloadResult || downloadResult.statusCode !== 200 || !downloadResult.tempFilePath) {
        throw new Error('视频下载失败')
      }
      await new Promise((resolve, reject) => {
        wx.saveVideoToPhotosAlbum({
          filePath: downloadResult.tempFilePath,
          success: resolve,
          fail: reject
        })
      })
      wx.showToast({ title: '视频已保存', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '视频下载失败', icon: 'none' })
    } finally {
      this.setData({ downloadingVideo: false })
    }
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

