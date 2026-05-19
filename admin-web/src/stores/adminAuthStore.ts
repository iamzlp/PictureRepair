import { create } from 'zustand'

import type { AdminProfile } from '@/utils/api'

const TOKEN_KEY = 'picture-repair-admin-token'
const ADMIN_KEY = 'picture-repair-admin-profile'

type AdminAuthState = {
  token: string | null
  admin: AdminProfile | null
  setSession: (payload: { token: string; admin: AdminProfile }) => void
  setAdmin: (admin: AdminProfile | null) => void
  clearSession: () => void
}

function readAdminFromStorage(): AdminProfile | null {
  const raw = window.localStorage.getItem(ADMIN_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AdminProfile
  } catch {
    window.localStorage.removeItem(ADMIN_KEY)
    return null
  }
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  token: window.localStorage.getItem(TOKEN_KEY),
  admin: readAdminFromStorage(),
  setSession: ({ token, admin }) => {
    window.localStorage.setItem(TOKEN_KEY, token)
    window.localStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
    set({ token, admin })
  },
  setAdmin: (admin) => {
    if (admin) {
      window.localStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
    } else {
      window.localStorage.removeItem(ADMIN_KEY)
    }
    set({ admin })
  },
  clearSession: () => {
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(ADMIN_KEY)
    set({ token: null, admin: null })
  },
}))
