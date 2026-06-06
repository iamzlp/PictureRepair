const api = require('../../utils/api')
const auth = require('../../utils/auth')

Page({
  data: {
    user: null,
    repairedCount: 0,
    balance: 0,
    avatarLoadErrorShown: false,
    avatarDraft: '',
    nicknameDraft: '',
    savingProfile: false
  },

  async onShow() {
    const tabbar = this.getTabBar && this.getTabBar()
    if (tabbar && tabbar.setData) {
      tabbar.setData({ selected: 2 })
    }
    try {
      await auth.ensureSession()
    } catch (error) {
      auth.navigateToLogin({ tab: '/pages/personal-centre/index' })
      return
    }
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh().finally(() => wx.stopPullDownRefresh())
  },

  async refresh() {
    try {
      const user = await auth.loadUser()
      const tasks = await api.listTasks({ skip: 0, limit: 100 })
      const repairedCount = (tasks || []).filter((t) => t.status === 'completed').length
      this.setData({
        user,
        repairedCount,
        balance: user && typeof user.mileage_balance === 'number' ? user.mileage_balance : (user && user.mileage_balance ? user.mileage_balance : 0),
        avatarLoadErrorShown: false,
        avatarDraft: user && user.avatar_url ? user.avatar_url : '',
        nicknameDraft: user && user.nickname ? user.nickname : ''
      })
    } catch (error) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  onAvatarError() {
    if (this.data.avatarLoadErrorShown) return
    const avatarUrl = this.data.user && this.data.user.avatar_url ? this.data.user.avatar_url : ''
    let host = ''
    if (avatarUrl) {
      const match = avatarUrl.match(/^https?:\/\/([^/]+)/)
      host = match ? match[1] : ''
    }
    this.setData({ avatarLoadErrorShown: true })
    wx.showToast({
      title: host ? `头像加载失败，请检查微信后台白名单：${host}` : '头像加载失败，请检查图片域名白名单',
      icon: 'none',
      duration: 3000
    })
  },

  onChooseAvatar(event) {
    const avatarUrl = event && event.detail ? (event.detail.avatarUrl || '') : ''
    if (!avatarUrl) return
    this.setData({ avatarDraft: avatarUrl })
  },

  onNicknameInput(event) {
    const nicknameDraft = event && event.detail ? (event.detail.value || '') : ''
    this.setData({ nicknameDraft })
  },

  async onSaveProfile() {
    if (this.data.savingProfile) return

    const nickname = this.data.nicknameDraft ? String(this.data.nicknameDraft).trim() : ''
    const avatarUrl = this.data.avatarDraft || ''
    if (!nickname && !avatarUrl) {
      wx.showToast({ title: '请先设置头像或昵称', icon: 'none' })
      return
    }

    this.setData({ savingProfile: true })
    try {
      const user = await auth.updateUserProfile({
        nickname,
        avatarUrl
      })
      this.setData({
        user,
        avatarDraft: user && user.avatar_url ? user.avatar_url : '',
        nicknameDraft: user && user.nickname ? user.nickname : '',
        avatarLoadErrorShown: false
      })
      wx.showToast({ title: '资料已更新', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '更新失败', icon: 'none' })
    } finally {
      this.setData({ savingProfile: false })
    }
  },

  goRecharge() {
    wx.navigateTo({ url: '/pages/personal-centre/recharge' })
  },

  goRechargeRecords() {
    wx.navigateTo({ url: '/pages/personal-centre/recharge-records' })
  },

  goServiceAgreement() {
    wx.navigateTo({ url: '/pages/personal-centre/service-agreement' })
  },

  goPrivacyPolicy() {
    wx.navigateTo({ url: '/pages/personal-centre/privacy-policy' })
  },

  goHelp() {
    wx.navigateTo({ url: '/pages/personal-centre/help-feedback' })
  },

  onLogout() {
    auth.clearToken()
    wx.showToast({ title: '已退出', icon: 'none' })
    wx.switchTab({ url: '/pages/index/index' })
  }
})

