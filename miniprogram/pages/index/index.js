const api = require('../../utils/api')
const auth = require('../../utils/auth')
const exportFlow = require('../../utils/export-flow')

const STATUS_TEXT = {
  pending: '等待处理',
  submitted: '已提交',
  processing: 'AI 修复中',
  downloading: '保存结果中',
  completed: '处理完成',
  failed: '处理失败'
}

function inferAspectRatio(width, height) {
  const safeWidth = Number(width || 0)
  const safeHeight = Number(height || 0)
  if (!safeWidth || !safeHeight) return '3:4'
  const ratio = safeWidth / safeHeight
  const candidates = {
    '1:1': 1,
    '3:4': 3 / 4,
    '16:9': 16 / 9,
    '9:16': 9 / 16
  }
  return Object.keys(candidates).sort((a, b) => {
    return Math.abs(candidates[a] - ratio) - Math.abs(candidates[b] - ratio)
  })[0] || '3:4'
}

Page({
  data: {
    user: null,
    localImage: '',
    photoUrl: '',
    imageAspectRatio: '3:4',
    mode: 'enhance',
    extraPrompt: '',
    taskId: '',
    progress: 0,
    status: '',
    statusText: '',
    errorMessage: '',
    resultUrl: '',
    uploading: false,
    creating: false,
    polling: false,
    exporting: false,
    canCreate: false,
    actionText: '开始修复'
  },

  async onShow() {
    const tabbar = this.getTabBar && this.getTabBar()
    if (tabbar && tabbar.setData) {
      tabbar.setData({ selected: 0 })
    }
    try {
      await auth.ensureSession()
    } catch (error) {}
    this.setData({
      user: getApp().globalData.user || null
    })
    this.refreshCreateState()
    await this.resumePendingExport()
  },

  onUnload() {
    this.stopPolling()
  },

  onExtraInput(event) {
    this.setData({ extraPrompt: event.detail.value })
  },

  onModeTap(event) {
    const mode = event.currentTarget.dataset.mode
    this.setData({ mode })
  },

  async requireLogin() {
    try {
      await auth.ensureSession()
      this.setData({
        user: getApp().globalData.user || null
      })
      this.refreshCreateState()
      return true
    } catch (error) {
      auth.navigateToLogin({ back: 1 })
      return false
    }
  },

  async onTakePhoto() {
    if (!(await this.requireLogin())) return
    return this.onChooseImageWithSource(['camera'])
  },

  async onPickFromAlbum() {
    if (!(await this.requireLogin())) return
    return this.onChooseImageWithSource(['album'])
  },

  async onChooseImageWithSource(sourceType) {
    if (this.data.uploading) return
    if (!(await this.requireLogin())) return

    try {
      const filePath = await this.chooseImage(sourceType)
      let aspectRatio = '3:4'
      try {
        const imageInfo = await this.getLocalImageInfo(filePath)
        aspectRatio = inferAspectRatio(imageInfo.width, imageInfo.height)
      } catch (error) {}
      this.stopPolling()
      this.setData({
        localImage: filePath,
        photoUrl: '',
        imageAspectRatio: aspectRatio,
        resultUrl: '',
        taskId: '',
        progress: 0,
        status: '',
        statusText: '',
        errorMessage: ''
      })

      this.setData({ uploading: true, actionText: '上传中' })
      const photo = await api.uploadPhoto(filePath)
      this.setData({
        photoUrl: photo.url,
        actionText: '开始修复'
      })
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '上传失败', icon: 'none' })
      this.setData({ actionText: '开始修复' })
    } finally {
      this.setData({ uploading: false })
      this.refreshCreateState()
    }
  },

  chooseImage(sourceType) {
    return new Promise((resolve, reject) => {
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: sourceType && sourceType.length ? sourceType : ['album', 'camera'],
          success: (res) => resolve(res.tempFiles[0].tempFilePath),
          fail: reject
        })
        return
      }

      wx.chooseImage({
        count: 1,
        sourceType: sourceType && sourceType.length ? sourceType : ['album', 'camera'],
        success: (res) => resolve(res.tempFilePaths[0]),
        fail: reject
      })
    })
  },

  getLocalImageInfo(filePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: filePath,
        success: resolve,
        fail: reject
      })
    })
  },

  async onCreateRepair() {
    if (!this.data.canCreate || this.data.creating || this.data.polling) return
    if (!(await this.requireLogin())) return

    this.setData({
      creating: true,
      resultUrl: '',
      progress: 3,
      status: 'pending',
      statusText: '创建任务中',
      actionText: '创建任务中'
    })

    try {
      let aspectRatio = this.data.imageAspectRatio || '3:4'
      if (this.data.localImage) {
        try {
          const imageInfo = await this.getLocalImageInfo(this.data.localImage)
          aspectRatio = inferAspectRatio(imageInfo.width, imageInfo.height)
          this.setData({ imageAspectRatio: aspectRatio })
        } catch (error) {}
      }
      const task = await api.createRepairTask({
        image_url: this.data.photoUrl,
        mode: this.data.mode,
        aspect_ratio: aspectRatio,
        extra_prompt: this.data.extraPrompt || undefined
      })
      this.setData({
        taskId: task.task_id || task.id,
        status: task.status,
        progress: task.progress || 5,
        statusText: STATUS_TEXT[task.status] || '处理中',
        errorMessage: '',
        creating: false
      })
      this.startPolling()
    } catch (error) {
      if (String(error.message).includes('Insufficient')) {
        wx.navigateTo({ url: '/pages/personal-centre/recharge?from=repair&source=index' })
        return
      }
      this.setData({
        creating: false,
        progress: 0,
        status: '',
        statusText: '',
        errorMessage: ''
      })
      wx.showToast({ title: error.message || '创建失败', icon: 'none' })
    } finally {
      this.refreshCreateState()
    }
  },

  startPolling() {
    this.stopPolling()
    this.setData({
      polling: true,
      actionText: '修复中'
    })
    this.pollTimer = setInterval(() => {
      this.fetchTask()
    }, 2500)
    this.fetchTask()
  },

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  },

  async fetchTask() {
    if (!this.data.taskId) return
    try {
      const task = await api.getRepairTask(this.data.taskId)
      const progress = typeof task.progress === 'number' ? task.progress : this.data.progress
      const status = task.status
      const errorMessage = status === 'failed' ? (task.error_message || '') : ''
      const statusText = status === 'failed' ? (errorMessage || STATUS_TEXT[status] || '处理失败') : (STATUS_TEXT[status] || '处理中')
      const nextData = {
        status,
        progress,
        statusText,
        errorMessage
      }

      if (task.result_url) nextData.resultUrl = task.result_url

      if (status === 'completed' || status === 'failed') {
        this.stopPolling()
        nextData.polling = false
        nextData.actionText = status === 'completed' ? '重新修复' : '重新尝试'
      }

      this.setData(nextData)
      this.refreshCreateState()
    } catch (error) {
      this.stopPolling()
      this.setData({
        polling: false,
        actionText: '重新尝试',
        statusText: error.message || '查询失败'
      })
      this.refreshCreateState()
    }
  },

  async onPreviewResult() {
    if (!this.data.resultUrl) return
    if (!(await this.requireLogin())) return
    wx.previewImage({
      urls: [this.data.resultUrl],
      current: this.data.resultUrl
    })
  },

  async onExportResult() {
    if (!this.data.taskId || this.data.exporting) return
    if (this.data.status !== 'completed') return
    if (!(await this.requireLogin())) return

    this.setData({ exporting: true })
    try {
      const result = await api.exportRepairTask(this.data.taskId)
      wx.previewImage({
        urls: [result.result_url],
        current: result.result_url
      })
      const user = await auth.loadUser()
      this.setData({ user })
    } catch (error) {
      if (String(error.message).includes('Insufficient')) {
        wx.navigateTo({ url: `/pages/personal-centre/recharge?from=export&source=index&taskId=${encodeURIComponent(this.data.taskId)}` })
        return
      }
      wx.showToast({ title: error.message || '下载失败', icon: 'none' })
    } finally {
      this.setData({ exporting: false })
      this.refreshCreateState()
    }
  },

  async resumePendingExport() {
    const pending = exportFlow.consumePendingExportAction('index', this.data.taskId)
    if (!pending) return
    await this.onExportResult()
  },

  refreshCreateState() {
    const busy = this.data.uploading || this.data.creating || this.data.polling
    this.setData({
      canCreate: Boolean(auth.getToken() && this.data.photoUrl && !busy),
      actionText: busy ? this.data.actionText : '开始修复'
    })
  },

  onShareAppMessage() {
    return {
      title: '老照片一键修复，重温美好回忆',
      path: '/pages/index/index'
    }
  }
})
