const { apiBaseUrl } = require('./config')

function getToken() {
  const app = getApp()
  return app.globalData.token || wx.getStorageSync('token') || ''
}

function normalizeTask(task) {
  if (!task || typeof task !== 'object') return task
  return Object.assign({}, task, {
    task_id: task.task_id || task.id || ''
  })
}

function request(options) {
  const token = getToken()
  const header = Object.assign({}, options.header || {})
  if (token) {
    header.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBaseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }
        reject(new Error(res.data && res.data.detail ? res.data.detail : `HTTP ${res.statusCode}`))
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.includes('timeout')) {
          reject(new Error('接口超时，请检查后端地址或网络连接'))
          return
        }
        reject(error)
      }
    })
  })
}

function uploadPhoto(filePath, category) {
  const token = getToken()

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${apiBaseUrl}/photos/upload`,
      filePath,
      name: 'file',
      formData: {
        category: category || 'old_photo'
      },
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(res.data))
          } catch (error) {
            reject(error)
          }
          return
        }

        let message = `HTTP ${res.statusCode}`
        try {
          const body = JSON.parse(res.data)
          message = body.detail || message
        } catch (error) {}
        reject(new Error(message))
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.includes('timeout')) {
          reject(new Error('上传超时，请检查后端地址或网络连接'))
          return
        }
        reject(error)
      }
    })
  })
}

function mockLogin(phone) {
  return request({
    url: `/auth/login/mock?phone=${encodeURIComponent(phone)}`,
    method: 'POST'
  })
}

function wechatLogin(code) {
  return request({
    url: '/auth/login/wechat',
    method: 'POST',
    data: { code }
  })
}

function bindWechatPhone(payload) {
  const data = typeof payload === 'string' ? { code: payload } : (payload || {})
  return request({
    url: '/auth/phone/wechat',
    method: 'POST',
    data
  })
}

function getMe() {
  return request({
    url: '/auth/me'
  })
}

function submitFeedback(payload) {
  return request({
    url: '/feedback',
    method: 'POST',
    data: payload || {}
  })
}

function createRepairTask(payload) {
  return request({
    url: '/repair/tasks',
    method: 'POST',
    data: payload
  })
}

function getRepairTask(taskId) {
  return request({
    url: `/repair/tasks/${taskId}`
  })
}

function listTasks(params) {
  const query = []
  if (params && typeof params.skip === 'number') query.push(`skip=${params.skip}`)
  if (params && typeof params.limit === 'number') query.push(`limit=${params.limit}`)
  const suffix = query.length ? `?${query.join('&')}` : ''
  return request({
    url: `/tasks${suffix}`
  }).then((tasks) => {
    if (!Array.isArray(tasks)) return []
    return tasks.map(normalizeTask)
  })
}

function exportRepairTask(taskId) {
  return request({
    url: `/repair/tasks/${taskId}/export`,
    method: 'POST'
  })
}

function getPackages() {
  return request({
    url: '/payments/packages'
  })
}

function mockPurchase(packageId) {
  return request({
    url: '/payments/mock-purchase',
    method: 'POST',
    data: {
      package_id: packageId
    }
  })
}

function listOrders(params) {
  const query = []
  if (params && typeof params.skip === 'number') query.push(`skip=${params.skip}`)
  if (params && typeof params.limit === 'number') query.push(`limit=${params.limit}`)
  const suffix = query.length ? `?${query.join('&')}` : ''
  return request({
    url: `/payments/orders${suffix}`
  })
}

function listTransactions(params) {
  const query = []
  if (params && typeof params.skip === 'number') query.push(`skip=${params.skip}`)
  if (params && typeof params.limit === 'number') query.push(`limit=${params.limit}`)
  const suffix = query.length ? `?${query.join('&')}` : ''
  return request({
    url: `/payments/transactions${suffix}`
  })
}

module.exports = {
  bindWechatPhone,
  createRepairTask,
  exportRepairTask,
  getPackages,
  getMe,
  getRepairTask,
  listOrders,
  listTasks,
  listTransactions,
  mockPurchase,
  mockLogin,
  submitFeedback,
  wechatLogin,
  uploadPhoto
}
