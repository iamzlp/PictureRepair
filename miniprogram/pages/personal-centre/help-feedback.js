const api = require('../../utils/api')
const auth = require('../../utils/auth')

const PAGE_PATH = '/pages/personal-centre/help-feedback'

function limitText(value, maxLength) {
  if (!value) return ''
  return String(value).trim().slice(0, maxLength)
}

function buildContactSessionFrom(payload) {
  const entries = Object.entries(payload || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
  return entries.join('&').slice(0, 1024)
}

Page({
  data: {
    types: ['功能建议', '程序漏洞', '支付相关', '其他问题'],
    typeIndex: 0,
    content: '',
    submitting: false,
    contactSessionFrom: '',
    lastFeedbackId: '',
    lastFeedbackType: '',
    lastFeedbackPreview: '',
    showSubmitSuccessTip: false
  },

  onShow() {
    this.updateContactSessionFrom()
  },

  onTypeChange(event) {
    this.setData({ typeIndex: Number(event.detail.value) || 0 }, () => {
      this.updateContactSessionFrom()
    })
  },

  onContentInput(event) {
    this.setData({ content: event.detail.value }, () => {
      this.updateContactSessionFrom()
    })
  },

  updateContactSessionFrom(extraPayload) {
    const app = getApp()
    const user = auth.getStoredUser() || app.globalData.user || null
    const currentType = this.data.types[this.data.typeIndex] || '其他问题'
    const payload = Object.assign(
      {
        scene: 'help_feedback',
        page: PAGE_PATH,
        user_id: user && user.id ? user.id : '',
        phone: user && user.phone ? user.phone : '',
        nickname: user && user.nickname ? limitText(user.nickname, 32) : '',
        feedback_id: this.data.lastFeedbackId || '',
        feedback_type: this.data.lastFeedbackType || currentType,
        preview: this.data.lastFeedbackPreview || limitText(this.data.content, 80)
      },
      extraPayload || {}
    )
    this.setData({
      contactSessionFrom: buildContactSessionFrom(payload)
    })
  },

  async onSubmit() {
    if (this.data.submitting) return
    if (!this.data.content || !this.data.content.trim()) {
      wx.showToast({ title: '请填写描述', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      const feedbackType = this.data.types[this.data.typeIndex] || '其他问题'
      const content = this.data.content.trim()
      const feedback = await api.submitFeedback({
        feedback_type: feedbackType,
        content,
        page_path: PAGE_PATH
      })
      wx.showToast({ title: '反馈已提交', icon: 'success' })
      this.setData({
        content: '',
        lastFeedbackId: feedback && feedback.id ? feedback.id : '',
        lastFeedbackType: feedbackType,
        lastFeedbackPreview: limitText(content, 80),
        showSubmitSuccessTip: true
      }, () => {
        this.updateContactSessionFrom()
      })
      wx.showModal({
        title: '反馈已提交',
        content: '已生成反馈编号，可复制编号并继续点击下方“联系客服”进入微信客服会话。',
        showCancel: false,
        confirmText: '我知道了'
      })
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  onCopyFeedbackId() {
    if (!this.data.lastFeedbackId) {
      wx.showToast({ title: '暂无反馈编号', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: this.data.lastFeedbackId,
      success: () => {
        wx.showToast({ title: '反馈编号已复制', icon: 'success' })
      }
    })
  }
})

