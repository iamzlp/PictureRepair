const api = require('../../utils/api')
const auth = require('../../utils/auth')

Page({
  data: {
    user: null,
    repairedCount: 0,
    balance: 0,
    avatarLoadErrorShown: false
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
        avatarLoadErrorShown: false
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

