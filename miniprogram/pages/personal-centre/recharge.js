const api = require('../../utils/api')
const auth = require('../../utils/auth')
const exportFlow = require('../../utils/export-flow')

function buildPackageView(item) {
  const priceText = (item.price_cents / 100).toFixed(2)
  const unit = item.credits > 0 ? (item.price_cents / 100 / item.credits).toFixed(2) : ''
  const subtitle = item.id === 'single_1' ? '单次照片' : `${item.title.replace('次', '次')}`
  const unitLabel = item.id === 'single_1' ? '' : `¥${unit} / 次`
  return {
    ...item,
    priceText: priceText.replace(/\.00$/, ''),
    subtitle,
    unitPriceText: unitLabel,
    recommended: item.id === 'bundle_30'
  }
}

Page({
  data: {
    packages: [],
    selectedId: '',
    paying: false,
    from: '',
    taskId: '',
    source: ''
  },

  onLoad(query) {
    this.setData({
      from: query && query.from ? String(query.from) : '',
      taskId: query && query.taskId ? String(query.taskId) : '',
      source: query && query.source ? String(query.source) : ''
    })
  },

  onShow() {
    if (!auth.getToken()) {
      auth.navigateToLogin({ back: 1 })
      return
    }
    this.loadPackages()
  },

  async loadPackages() {
    try {
      const list = await api.getPackages()
      const packages = (list || []).map(buildPackageView)
      const defaultId = packages.find((p) => p.recommended)?.id || (packages[0] && packages[0].id) || ''
      this.setData({
        packages,
        selectedId: this.data.selectedId || defaultId
      })
    } catch (error) {
      this.setData({ packages: [] })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  onSelect(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    this.setData({ selectedId: id })
  },

  onClose() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.switchTab({ url: '/pages/index/index' })
  },

  async onPay() {
    if (!this.data.selectedId || this.data.paying) return
    if (!auth.getToken()) {
      auth.navigateToLogin({ back: 1 })
      return
    }
    this.setData({ paying: true })
    try {
      const result = await api.createWechatPurchase(this.data.selectedId)
      await this.requestWechatPayment(result)
      const paidOrder = await this.waitForOrderPaid(result.order_id)
      await auth.loadUser()
      if (paidOrder) {
        wx.showToast({ title: '支付成功', icon: 'success' })
      } else {
        await new Promise((resolve) => {
          wx.showModal({
            title: '支付成功',
            content: '微信已支付成功，点数正在确认到账，通常几秒内会自动刷新。',
            showCancel: false,
            success: resolve,
            fail: resolve
          })
        })
      }
      this.handleAfterPaySuccess()
    } catch (error) {
      const errMsg = error && error.errMsg ? String(error.errMsg) : ''
      const message = errMsg.includes('cancel') ? '已取消支付' : (error.message || '支付失败')
      wx.showToast({ title: message, icon: 'none' })
    } finally {
      this.setData({ paying: false })
    }
  },

  requestWechatPayment(result) {
    return new Promise((resolve, reject) => {
      wx.requestPayment({
        timeStamp: String(result.timeStamp || ''),
        nonceStr: String(result.nonceStr || ''),
        package: String(result.package || ''),
        signType: String(result.signType || 'RSA'),
        paySign: String(result.paySign || ''),
        success: resolve,
        fail: reject
      })
    })
  },

  handleAfterPaySuccess() {
    if ((this.data.from === 'export' || this.data.from === 'video' || this.data.from === 'regenerate') && this.data.taskId && this.data.source) {
      exportFlow.setPendingExportAction({
        action: this.data.from,
        source: this.data.source,
        taskId: this.data.taskId
      })
      wx.navigateBack()
      return
    }
    if (this.data.from === 'repair' && this.data.source === 'index') {
      wx.switchTab({ url: '/pages/index/index' })
      return
    }
    wx.switchTab({ url: '/pages/personal-centre/index' })
  },

  async waitForOrderPaid(orderId) {
    if (!orderId) return null
    for (let i = 0; i < 6; i += 1) {
      const order = await api.getOrder(orderId).catch(() => null)
      if (order && order.status === 'paid') {
        return order
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    return null
  }
})

