const PENDING_EXPORT_KEY = 'pending_export_action'

function setPendingExportAction(payload) {
  if (!payload || !payload.source || !payload.taskId) return
  wx.setStorageSync(PENDING_EXPORT_KEY, {
    action: payload.action ? String(payload.action) : 'export',
    source: String(payload.source),
    taskId: String(payload.taskId),
    createdAt: Date.now()
  })
}

function consumePendingExportAction(source, taskId, action) {
  const payload = wx.getStorageSync(PENDING_EXPORT_KEY)
  if (!payload || typeof payload !== 'object') return null
  const expectedAction = action ? String(action) : 'export'
  if (String(payload.action || 'export') !== expectedAction) return null
  if (String(payload.source || '') !== String(source || '')) return null
  if (taskId && String(payload.taskId || '') !== String(taskId)) return null
  wx.removeStorageSync(PENDING_EXPORT_KEY)
  return payload
}

module.exports = {
  consumePendingExportAction,
  setPendingExportAction
}
