import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authenticateWithUserTable, fetchAdminProfile } from '@/lib/supabase/queries'
import type { AdminProfile } from '@/types'

const CURRENT_USER_KEY = 'schoolconnect_current_user_profile'

interface AuthContextType {
  user: any
  session: any
  admin: AdminProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  hasFullAccess: () => boolean
  getPermittedSchoolIds: (allSchoolIds: string[]) => string[]
  isSchoolPermitted: (schoolId: string, allSchoolIds: string[]) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(() => {
    try {
      const saved = localStorage.getItem(CURRENT_USER_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (admin) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(admin))
    } else {
      localStorage.removeItem(CURRENT_USER_KEY)
    }
  }, [admin])

  const signIn = async (email: string, password: string) => {
    const profile = await authenticateWithUserTable(email, password)
    if (!profile) {
      throw new Error('Invalid email or password.')
    }
    setAdmin(profile)
  }

  const signOut = async () => {
    setAdmin(null)
    localStorage.removeItem(CURRENT_USER_KEY)
  }


  const hasFullAccess = () => {
    if (!admin) return true // Default fallback for unauthenticated / demo
    return admin.role === 'admin' || admin.role === 'superadmin' || admin.role === 'psds'
  }

  const getPermittedSchoolIds = (allSchoolIds: string[]) => {
    if (!admin || hasFullAccess()) return allSchoolIds
    return admin.assigned_school_ids && admin.assigned_school_ids.length > 0
      ? admin.assigned_school_ids
      : allSchoolIds
  }

  const isSchoolPermitted = (schoolId: string, allSchoolIds: string[]) => {
    if (!admin || hasFullAccess()) return true
    const permitted = getPermittedSchoolIds(allSchoolIds)
    return permitted.includes(schoolId)
  }

  return (
    <AuthContext.Provider
      value={{
        user: admin,
        session: admin ? { user: admin } : null,
        admin,
        loading,
        signIn,
        signOut,
        hasFullAccess,
        getPermittedSchoolIds,
        isSchoolPermitted,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}


export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
