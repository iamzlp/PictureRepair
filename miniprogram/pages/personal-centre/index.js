const api = require('../../utils/api')
const auth = require('../../utils/auth')

Page({
  data: {
    user: null,
    repairedCount: 0,
    balance: 0
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
        balance: user && typeof user.mileage_balance === 'number' ? user.mileage_balance : (user && user.mileage_balance ? user.mileage_balance : 0)
      })
    } catch (error) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
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

