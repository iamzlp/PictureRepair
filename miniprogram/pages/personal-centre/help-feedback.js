Page({
  data: {
    types: ['功能建议', '程序漏洞', '支付相关', '其他问题'],
    typeIndex: 0,
    content: ''
  },

  onTypeChange(event) {
    this.setData({ typeIndex: Number(event.detail.value) || 0 })
  },

  onContentInput(event) {
    this.setData({ content: event.detail.value })
  },

  onSubmit() {
    if (!this.data.content || !this.data.content.trim()) {
      wx.showToast({ title: '请填写描述', icon: 'none' })
      return
    }
    wx.showToast({ title: '已提交', icon: 'success' })
    this.setData({ content: '' })
  },

  onSupport() {
    wx.showToast({ title: '敬请期待', icon: 'none' })
  }
})

