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
    savingAvatar: false,
    savingNickname: false
  },

  applyUserState(user) {
    const mergedUser = Object.assign({}, this.data.user || {}, user || {})
    this.setData({
      user: mergedUser,
      balance: mergedUser && typeof mergedUser.mileage_balance === 'number' ? mergedUser.mileage_balance : (mergedUser && mergedUser.mileage_balance ? mergedUser.mileage_balance : 0),
      avatarLoadErrorShown: false,
      avatarDraft: mergedUser && mergedUser.avatar_url ? mergedUser.avatar_url : '',
      nicknameDraft: mergedUser && mergedUser.nickname ? mergedUser.nickname : '游客'
    })
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
      this.setData({ repairedCount })
      this.applyUserState(user)
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
    this.setData({ avatarDraft: avatarUrl }, () => {
      this.saveAvatarProfile(avatarUrl)
    })
  },

  onNicknameInput(event) {
    const nicknameDraft = event && event.detail ? (event.detail.value || '') : ''
    this.setData({ nicknameDraft })
  },

  async onNicknameBlur(event) {
    if (this.data.savingNickname) return

    const rawNickname = event && event.detail ? (event.detail.value || '') : this.data.nicknameDraft
    const nickname = rawNickname ? String(rawNickname).trim() : ''
    const currentNickname = this.data.user && this.data.user.nickname ? String(this.data.user.nickname).trim() : ''
    const currentDisplayNickname = currentNickname || '游客'

    if (!nickname) {
      this.setData({ nicknameDraft: currentDisplayNickname })
      return
    }

    if (nickname === currentDisplayNickname) {
      this.setData({ nicknameDraft: nickname })
      return
    }

    this.setData({ savingNickname: true, nicknameDraft: nickname })
    try {
      const user = await auth.updateUserProfile({
        nickname
      })
      this.applyUserState(user)
      wx.showToast({ title: '昵称已更新', icon: 'success' })
    } catch (error) {
      this.setData({ nicknameDraft: currentDisplayNickname })
      wx.showToast({ title: error.message || '昵称更新失败', icon: 'none' })
    } finally {
      this.setData({ savingNickname: false })
    }
  },

  async saveAvatarProfile(avatarUrl) {
    if (!avatarUrl || this.data.savingAvatar) return

    this.setData({ savingAvatar: true })
    try {
      const user = await auth.updateUserProfile({ avatarUrl })
      this.applyUserState(user)
      wx.showToast({ title: '头像已更新', icon: 'success' })
    } catch (error) {
      this.setData({
        avatarDraft: this.data.user && this.data.user.avatar_url ? this.data.user.avatar_url : ''
      })
      wx.showToast({ title: error.message || '头像更新失败', icon: 'none' })
    } finally {
      this.setData({ savingAvatar: false })
    }
  },

  goRecharge() {
    wx.navigateTo({ url: '/pages/personal-centre/recharge' })
  },

  goRechargeRecords() {
    wx.navigateTo({ url: '/pages/personal-centre/recharge-records' })
  },

  goCreditRecords() {
    wx.navigateTo({ url: '/pages/personal-centre/credit-records' })
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

