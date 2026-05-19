const auth = require('./utils/auth')

App({
  onLaunch() {
    auth.ensureSession().catch(() => {})
  },

  globalData: {
    token: wx.getStorageSync('token') || '',
    user: null
  }
})
