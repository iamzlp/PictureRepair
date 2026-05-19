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
      const result = await api.mockPurchase(this.data.selectedId)
      await auth.loadUser()
      wx.showToast({ title: '支付成功', icon: 'success' })

      if (this.data.from === 'export' && this.data.taskId && this.data.source) {
        exportFlow.setPendingExportAction({
          source: this.data.source,
          taskId: this.data.taskId
        })
        wx.navigateBack()
        return
      }
      wx.switchTab({ url: '/pages/personal-centre/index' })
    } catch (error) {
      wx.showToast({ title: error.message || '支付失败', icon: 'none' })
    } finally {
      this.setData({ paying: false })
    }
  }
})

