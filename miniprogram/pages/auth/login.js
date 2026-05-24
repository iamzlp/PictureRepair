const auth = require('../../utils/auth')

Page({
  data: {
    agreed: true,
    loggingIn: false,
    avatarUrl: '',
    nickname: '',
    tab: '',
    back: '',
    redirect: ''
  },

  onLoad(query) {
    this.setData({
      tab: query && query.tab ? decodeURIComponent(query.tab) : '',
      back: query && query.back ? String(query.back) : '',
      redirect: query && query.redirect ? decodeURIComponent(query.redirect) : ''
    })
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },

  openServiceAgreement() {
    wx.navigateTo({ url: '/pages/personal-centre/service-agreement' })
  },

  openPrivacyPolicy() {
    wx.navigateTo({ url: '/pages/personal-centre/privacy-policy' })
  },

  onClose() {
    if (this.data.tab) {
      wx.switchTab({ url: '/pages/index/index' })
      return
    }
    if (this.data.redirect) {
      wx.redirectTo({ url: this.data.redirect })
      return
    }
    if (this.data.back && Number(this.data.back) > 0) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/index/index' })
  },

  onChooseAvatar(event) {
    const avatarUrl = event && event.detail ? (event.detail.avatarUrl || '') : ''
    this.setData({ avatarUrl })
  },

  onNicknameInput(event) {
    const nickname = event && event.detail ? (event.detail.value || '') : ''
    this.setData({ nickname })
  },

  async onWechatLogin(event) {
    if (this.data.loggingIn) return
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选协议', icon: 'none' })
      return
    }
    if (!event || !event.detail || !event.detail.code) {
      wx.showToast({ title: '需要先授权手机号', icon: 'none' })
      return
    }
    if (!this.data.avatarUrl) {
      wx.showToast({ title: '请先选择微信头像', icon: 'none' })
      return
    }
    if (!this.data.nickname || !String(this.data.nickname).trim()) {
      wx.showToast({ title: '请先填写微信昵称', icon: 'none' })
      return
    }

    this.setData({ loggingIn: true })
    try {
      await auth.loginWithWechatPhone(event.detail.code, {
        avatarUrl: this.data.avatarUrl,
        nickname: this.data.nickname
      })

      if (this.data.tab) {
        wx.switchTab({ url: this.data.tab })
        return
      }

      if (this.data.redirect) {
        wx.redirectTo({ url: this.data.redirect })
        return
      }

      if (this.data.back && Number(this.data.back) > 0) {
        wx.navigateBack()
        return
      }

      wx.switchTab({ url: '/pages/index/index' })
    } catch (error) {
      wx.showToast({ title: error.message || '微信授权登录失败', icon: 'none' })
    } finally {
      this.setData({ loggingIn: false })
    }
  }
})

