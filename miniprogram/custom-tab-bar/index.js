const TAB_PAGES = [
  '/pages/index/index',
  '/pages/repair-record/index',
  '/pages/personal-centre/index'
]

function getToken() {
  const app = getApp()
  return app.globalData.token || wx.getStorageSync('token') || ''
}

Component({
  data: {
    selected: 0
  },

  lifetimes: {
    attached() {
      const pages = getCurrentPages()
      const current = pages[pages.length - 1]
      const route = current ? `/${current.route}` : ''
      const idx = TAB_PAGES.indexOf(route)
      if (idx >= 0) {
        this.setData({ selected: idx })
      }
    }
  },

  methods: {
    onTabTap(event) {
      const index = Number(event.currentTarget.dataset.index)
      const url = TAB_PAGES[index]
      if (!url) return
      if (index !== 0 && !getToken()) {
        wx.navigateTo({
          url: `/pages/auth/login?tab=${encodeURIComponent(url)}`
        })
        return
      }
      wx.switchTab({ url })
    }
  }
})
