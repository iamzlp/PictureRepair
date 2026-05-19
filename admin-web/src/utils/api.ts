import axios from 'axios'

export type AdminProfile = {
  id: string
  username: string
  role: string
  is_active: boolean
  last_login_at?: string
  created_at: string
}

export type AdminLoginResponse = {
  access_token: string
  token_type: string
  admin: AdminProfile
}

export type AdminDashboardSummary = {
  total_users: number
  total_tasks: number
  total_orders: number
  total_transactions: number
  completed_tasks: number
  failed_tasks: number
  today_new_users: number
  today_tasks: number
  today_exports: number
  today_orders: number
  today_revenue_cents: number
}

export type AdminUser = {
  id: string
  phone?: string
  openid?: string
  unionid?: string
  nickname?: string
  avatar_url?: string
  mileage_balance: number
  created_at: string
}

export type AdminTask = {
  task_id: string
  user_id?: string
  batch_id?: string
  status: string
  prompt: string
  task_type?: string
  style: string
  aspect_ratio: string
  reference_image_url?: string
  result_url?: string
  progress: number
  error_message?: string
  external_task_id?: string
  created_at?: string
  updated_at?: string
}

export type AdminOrder = {
  id: string
  user_id: string
  package_id: string
  title: string
  price_cents: number
  credits: number
  status: string
  payment_provider: string
  provider_trade_no?: string
  created_at: string
  paid_at?: string
}

export type AdminTransaction = {
  id: string
  user_id: string
  change: number
  balance_after: number
  transaction_type: string
  reference_id?: string
  description?: string
  created_at: string
}

export type AdminAuditLog = {
  id: string
  admin_user_id: string
  action: string
  target_type: string
  target_id?: string
  reason?: string
  before_json?: string
  after_json?: string
  created_at: string
}

export type CreditPackage = {
  id: string
  title: string
  price_cents: number
  credits: number
}

export type AdminSystemConfig = {
  storage_type: string
  image_model: string
  mock_image_generation: boolean
  mock_wechat_login: boolean
  payment_use_test_prices: boolean
  payment_test_price_single_1_cents: number
  payment_test_price_bundle_30_cents: number
  payment_test_price_bundle_90_cents: number
  packages: CreditPackage[]
}

type QueryValue = string | number | undefined | null

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1/admin',
  timeout: 15000,
})

function withAuth(token: string) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
}

function buildSearchParams(params: Record<string, QueryValue>) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })
  return searchParams
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { detail?: string } | undefined)?.detail || error.message || fallback
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

export function normalizeError(error: unknown, fallback: string) {
  return getErrorMessage(error, fallback)
}

export async function loginAdmin(payload: { username: string; password: string }) {
  const { data } = await client.post<AdminLoginResponse>('/auth/login', payload)
  return data
}

export async function fetchAdminMe(token: string) {
  const { data } = await client.get<AdminProfile>('/auth/me', withAuth(token))
  return data
}

export async function fetchDashboardSummary(token: string) {
  const { data } = await client.get<AdminDashboardSummary>('/dashboard/summary', withAuth(token))
  return data
}

export async function fetchSystemConfig(token: string) {
  const { data } = await client.get<AdminSystemConfig>('/system/config', withAuth(token))
  return data
}

export async function fetchUsers(token: string, params: { phone?: string; nickname?: string; skip?: number; limit?: number }) {
  const query = buildSearchParams(params).toString()
  const { data } = await client.get<AdminUser[]>(query ? `/users?${query}` : '/users', withAuth(token))
  return data
}

export async function fetchUserDetail(token: string, userId: string) {
  const { data } = await client.get<AdminUser>(`/users/${userId}`, withAuth(token))
  return data
}

export async function adjustUserCredits(
  token: string,
  userId: string,
  payload: { change: number; reason: string }
) {
  const { data } = await client.post(`/users/${userId}/credits/adjust`, payload, withAuth(token))
  return data
}

export async function fetchTasks(
  token: string,
  params: { status?: string; task_type?: string; user_id?: string; skip?: number; limit?: number }
) {
  const query = buildSearchParams(params).toString()
  const { data } = await client.get<AdminTask[]>(query ? `/tasks?${query}` : '/tasks', withAuth(token))
  return data
}

export async function retryTask(token: string, taskId: string) {
  const { data } = await client.post<AdminTask>(`/tasks/${taskId}/retry`, undefined, withAuth(token))
  return data
}

export async function fetchTaskDetail(token: string, taskId: string) {
  const { data } = await client.get<AdminTask>(`/tasks/${taskId}`, withAuth(token))
  return data
}

export async function fetchOrders(
  token: string,
  params: { status?: string; package_id?: string; user_id?: string; skip?: number; limit?: number }
) {
  const query = buildSearchParams(params).toString()
  const { data } = await client.get<AdminOrder[]>(query ? `/orders?${query}` : '/orders', withAuth(token))
  return data
}

export async function fetchOrderDetail(token: string, orderId: string) {
  const { data } = await client.get<AdminOrder>(`/orders/${orderId}`, withAuth(token))
  return data
}

export async function fetchTransactions(
  token: string,
  params: { user_id?: string; transaction_type?: string; reference_id?: string; skip?: number; limit?: number }
) {
  const query = buildSearchParams(params).toString()
  const { data } = await client.get<AdminTransaction[]>(query ? `/transactions?${query}` : '/transactions', withAuth(token))
  return data
}

export async function fetchAuditLogs(
  token: string,
  params: {
    action?: string
    target_type?: string
    admin_user_id?: string
    target_id?: string
    reason?: string
    start_at?: string
    end_at?: string
    skip?: number
    limit?: number
  }
) {
  const query = buildSearchParams(params).toString()
  const { data } = await client.get<AdminAuditLog[]>(query ? `/audit-logs?${query}` : '/audit-logs', withAuth(token))
  return data
}
