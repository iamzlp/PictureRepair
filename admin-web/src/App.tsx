import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { AdminShell } from '@/components/layout/AdminShell'
import { AuditLogsPage } from '@/pages/AuditLogsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { FeedbacksPage } from '@/pages/FeedbacksPage'
import { LoginPage } from '@/pages/LoginPage'
import { OrderDetailPage } from '@/pages/OrderDetailPage'
import { OrdersPage } from '@/pages/OrdersPage'
import { SystemConfigPage } from '@/pages/SystemConfigPage'
import { TaskDetailPage } from '@/pages/TaskDetailPage'
import { TasksPage } from '@/pages/TasksPage'
import { TransactionsPage } from '@/pages/TransactionsPage'
import { UsersPage } from '@/pages/UsersPage'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { fetchAdminMe } from '@/utils/api'

function FullScreenLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-archive-ink text-archive-paper">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-archive-copper/20 border-t-archive-copper" />
        <p className="font-body text-sm tracking-[0.25em] text-archive-paper/70 uppercase">{label}</p>
      </div>
    </div>
  )
}

function ProtectedRoute() {
  const token = useAdminAuthStore((state) => state.token)
  const admin = useAdminAuthStore((state) => state.admin)

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!admin) {
    return <FullScreenLoading label="恢复后台会话中" />
  }

  return <Outlet />
}

export default function App() {
  const token = useAdminAuthStore((state) => state.token)
  const admin = useAdminAuthStore((state) => state.admin)
  const setAdmin = useAdminAuthStore((state) => state.setAdmin)
  const clearSession = useAdminAuthStore((state) => state.clearSession)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let active = true

    async function restoreSession() {
      if (!token) {
        if (active) {
          setBooting(false)
        }
        return
      }

      if (admin) {
        if (active) {
          setBooting(false)
        }
        return
      }

      try {
        const profile = await fetchAdminMe(token)
        if (active) {
          setAdmin(profile)
        }
      } catch (error) {
        console.error(error)
        if (active) {
          clearSession()
        }
      } finally {
        if (active) {
          setBooting(false)
        }
      }
    }

    restoreSession()

    return () => {
      active = false
    }
  }, [token, admin, setAdmin, clearSession])

  if (booting) {
    return <FullScreenLoading label="读取档案室控制台" />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={token && admin ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/feedback" element={<FeedbacksPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/system-config" element={<SystemConfigPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
