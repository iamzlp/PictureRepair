const api = require('./api')
const AUTH_MODE_KEY = 'auth_mode'
const USER_PROFILE_KEY = 'user_profile'

function getToken() {
  const app = getApp()
  return app.globalData.token || wx.getStorageSync('token') || ''
}

function getAuthMode() {
  return wx.getStorageSync(AUTH_MODE_KEY) || ''
}

function getStoredUser() {
  return wx.getStorageSync(USER_PROFILE_KEY) || null
}

function setToken(token, mode) {
  const app = getApp()
  app.globalData.token = token || ''
  wx.setStorageSync('token', token || '')
  if (mode) {
    wx.setStorageSync(AUTH_MODE_KEY, mode)
  }
}

function clearToken() {
  const app = getApp()
  app.globalData.token = ''
  app.globalData.user = null
  wx.removeStorageSync('token')
  wx.removeStorageSync(AUTH_MODE_KEY)
  wx.removeStorageSync(USER_PROFILE_KEY)
}

async function loadUser() {
  const token = getToken()
  if (!token) return null
  const user = await api.getMe()
  const app = getApp()
  app.globalData.user = user
  wx.setStorageSync(USER_PROFILE_KEY, user || null)
  return user
}

function getWechatCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res && res.code) {
          resolve(res.code)
          return
        }
        reject(new Error('获取微信登录凭证失败'))
      },
      fail(error) {
        reject(error)
      }
    })
  })
}

function getWechatProfile() {
  return new Promise((resolve) => {
    if (!wx.getUserProfile) {
      resolve(null)
      return
    }

    wx.getUserProfile({
      desc: '用于展示微信头像和昵称',
      success(res) {
        const userInfo = res && res.userInfo ? res.userInfo : null
        if (!userInfo) {
          resolve(null)
          return
        }
        resolve({
          nickname: userInfo.nickName || '',
          avatar_url: userInfo.avatarUrl || ''
        })
      },
      fail() {
        resolve(null)
      }
    })
  })
}

async function loginWithWechat() {
  const code = await getWechatCode()
  const loginResult = await api.wechatLogin(code)
  setToken(loginResult.access_token, 'wechat')
  await loadUser()
  return true
}

async function loginWithWechatPhone(phoneCode) {
  if (!phoneCode) {
    throw new Error('未获取到手机号授权凭证')
  }

  try {
    await loginWithWechat()
    const profile = await getWechatProfile()
    const user = await api.bindWechatPhone({
      code: phoneCode,
      nickname: profile && profile.nickname ? profile.nickname : undefined,
      avatar_url: profile && profile.avatar_url ? profile.avatar_url : undefined
    })
    const app = getApp()
    app.globalData.user = user
    wx.setStorageSync(USER_PROFILE_KEY, user || null)
    return true
  } catch (error) {
    clearToken()
    throw error
  }
}

function hasBoundPhone(user) {
  return !!(user && user.phone)
}

function hasUsableSessionSync() {
  return !!(getToken() && hasBoundPhone(getStoredUser()))
}

async function ensureSession() {
  const token = getToken()
  if (!token) {
    throw new Error('请先登录')
  }

  try {
    const user = await loadUser()
    if (!hasBoundPhone(user)) {
      throw new Error('请先完成手机号授权')
    }
    return true
  } catch (error) {
    clearToken()
    throw error
  }
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
  getStoredUser,
  getToken,
  getAuthMode,
  hasUsableSessionSync,
  loginWithWechatPhone,
  loginWithWechat,
  loadUser,
  navigateToLogin,
  setToken
}
