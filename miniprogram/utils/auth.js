const api = require('./api')
const DEFAULT_DEV_PHONE = '13800138000'

function getToken() {
  const app = getApp()
  return app.globalData.token || wx.getStorageSync('token') || ''
}

function setToken(token) {
  const app = getApp()
  app.globalData.token = token || ''
  wx.setStorageSync('token', token || '')
}

function clearToken() {
  const app = getApp()
  app.globalData.token = ''
  app.globalData.user = null
  wx.removeStorageSync('token')
}

async function loadUser() {
  const token = getToken()
  if (!token) return null
  const user = await api.getMe()
  const app = getApp()
  app.globalData.user = user
  return user
}

async function ensureSession() {
  const token = getToken()
  if (token) {
    try {
      await loadUser()
      return true
    } catch (error) {
      clearToken()
    }
  }

  const loginResult = await api.mockLogin(DEFAULT_DEV_PHONE)
  setToken(loginResult.access_token)
  await loadUser()
  return true
}

function navigateToLogin(options) {
  const query = []
  if (options && options.tab) query.push(`tab=${encodeURIComponent(options.tab)}`)
  if (options && options.back) query.push(`back=${encodeURIComponent(String(options.back))}`)
  if (options && options.redirect) query.push(`redirect=${encodeURIComponent(options.redirect)}`)
  const url = `/pages/auth/login${query.length ? `?${query.join('&')}` : ''}`
  wx.navigateTo({ url })
}

module.exports = {
  clearToken,
  ensureSession,
  getToken,
  loadUser,
  navigateToLogin,
  setToken
}
