const auth = require('./utils/auth')

App({
  onLaunch() {
    if (auth.getToken()) {
      auth.ensureSession().catch(() => {})
    }
  },

  globalData: {
    token: wx.getStorageSync('token') || '',
    user: wx.getStorageSync('user_profile') || null
  }
})
