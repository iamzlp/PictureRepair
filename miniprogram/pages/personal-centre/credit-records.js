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

function getTransactionMeta(type, description) {
  const metaMap = {
    purchase: {
      title: '充值获得',
      fallbackDescription: '充值成功，点数已到账'
    },
    export: {
      title: '下载高清',
      fallbackDescription: '下载修复后的高清照片'
    },
    video_generate: {
      title: '生成视频',
      fallbackDescription: '生成老照片动态视频'
    },
    video_refund: {
      title: '视频退款',
      fallbackDescription: '视频生成失败，已退回点数'
    },
    adjust: {
      title: '后台调整',
      fallbackDescription: '管理员调整点数'
    }
  }
  const meta = metaMap[type] || {
    title: '点数变动',
    fallbackDescription: '点数余额发生变化'
  }
  return {
    title: meta.title,
    description: description || meta.fallbackDescription
  }
}

function normalizeTransaction(item) {
  const change = typeof item.change === 'number' ? item.change : Number(item.change || 0)
  const meta = getTransactionMeta(item.transaction_type, item.description)
  return Object.assign({}, item, {
    timeText: formatTime(item.created_at),
    titleText: meta.title,
    descriptionText: meta.description,
    changeText: `${change > 0 ? '+' : ''}${change}`,
    balanceText: `余额 ${item.balance_after || 0} 点`,
    changeClass: change >= 0 ? 'plus' : 'minus'
  })
}

Page({
  data: {
    loading: false,
    loadingMore: false,
    noMore: false,
    skip: 0,
    limit: 20,
    transactions: []
  },

  onShow() {
    if (!auth.getToken()) {
      auth.navigateToLogin({ back: 1 })
      return
    }
    if (!this.data.transactions.length) {
      this.loadFirstPage()
    }
  },

  onPullDownRefresh() {
    this.loadFirstPage().finally(() => wx.stopPullDownRefresh())
  },

  async loadFirstPage() {
    this.setData({ skip: 0, noMore: false, transactions: [] })
    await this.loadMore(true)
  },

  onLoadMore() {
    return this.loadMore(false)
  },

  async loadMore(isFirst) {
    if (this.data.loadingMore) return
    this.setData({ loading: Boolean(isFirst), loadingMore: true })
    try {
      const list = await api.listTransactions({ skip: this.data.skip, limit: this.data.limit })
      const transactions = (list || []).map(normalizeTransaction)
      this.setData({
        transactions: this.data.transactions.concat(transactions),
        skip: this.data.skip + transactions.length,
        noMore: transactions.length < this.data.limit
      })
    } catch (error) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false, loadingMore: false })
    }
  }
})
