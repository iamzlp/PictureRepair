const auth = require('../../utils/auth')

function getPhoneAuthErrorMessage(event) {
  const detail = event && event.detail ? event.detail : {}
  const errMsg = detail && detail.errMsg ? String(detail.errMsg) : ''

  if (!errMsg) {
    return '需要先授权手机号'
  }

  if (errMsg.includes('getPhoneNumber:fail user deny')) {
    return '你已取消手机号授权'
  }

  if (errMsg.includes('getPhoneNumber:fail user cancel')) {
    return '你已取消手机号授权'
  }

  if (errMsg.includes('privacy permission is not authorized')) {
    return '隐私授权未完成，请先同意手机号相关隐私授权'
  }

  return `手机号授权失败：${errMsg}`
}

Page({
  data: {
    agreed: true,
    loggingIn: false,
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

  async onWechatLogin(event) {
    if (this.data.loggingIn) return
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选协议', icon: 'none' })
      return
    }
    if (!event || !event.detail || !event.detail.code) {
      wx.showToast({ title: getPhoneAuthErrorMessage(event), icon: 'none' })
      return
    }
    this.setData({ loggingIn: true })
    try {
      await auth.loginWithWechatPhone(event.detail.code)

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

