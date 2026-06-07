const api = require('../../utils/api')
const auth = require('../../utils/auth')

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

Page({
  data: {
    loading: false,
    loadingMore: false,
    noMore: false,
    skip: 0,
    limit: 20,
    orders: []
  },

  onShow() {
    if (!auth.getToken()) {
      auth.navigateToLogin({ back: 1 })
      return
    }
    if (!this.data.orders.length) {
      this.loadFirstPage()
    }
  },

  onPullDownRefresh() {
    this.loadFirstPage().finally(() => wx.stopPullDownRefresh())
  },

  async loadFirstPage() {
    this.setData({ skip: 0, noMore: false, orders: [] })
    await this.loadMore(true)
  },

  onLoadMore() {
    return this.loadMore(false)
  },

  async loadMore(isFirst) {
    if (this.data.loadingMore) return
    this.setData({ loading: Boolean(isFirst), loadingMore: true })
    try {
      const list = await api.listOrders({
        skip: this.data.skip,
        limit: this.data.limit,
        successfulOnly: true
      })
      const orders = (list || []).map((o) => ({
        ...o,
        timeText: formatTime(o.paid_at || o.created_at),
        amountText: (o.price_cents / 100).toFixed(2)
      }))
      this.setData({
        orders: this.data.orders.concat(orders),
        skip: this.data.skip + orders.length,
        noMore: orders.length < this.data.limit
      })
    } catch (error) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false, loadingMore: false })
    }
  }
})

