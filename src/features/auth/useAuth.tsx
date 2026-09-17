import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authenticateWithUserTable, fetchAdminProfile } from '@/lib/supabase/queries'
import type { AdminProfile } from '@/types'

const CURRENT_USER_KEY = 'schoolconnect_current_user_profile'

interface AuthContextType {
  user: any
  session: any
  admin: AdminProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AdminProfile>
  signOut: () => Promise<void>
  updateAdminProfile: (updatedFields: Partial<AdminProfile>) => void
  hasFullAccess: () => boolean
  getPermittedSchoolIds: (allSchoolIds?: string[]) => string[]
  isSchoolPermitted: (schoolId: string, allSchoolIds?: string[]) => boolean
  getPermittedSchools: <T extends { id: string }>(schools: T[]) => T[]
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
      throw new Error('WRONG_CREDENTIALS: Invalid email or password.')
    }
    setAdmin(profile)
    return profile
  }

  const signOut = async () => {
    setAdmin(null)
    localStorage.removeItem(CURRENT_USER_KEY)
  }

  const updateAdminProfile = (updatedFields: Partial<AdminProfile>) => {
    setAdmin(prev => {
      if (!prev) return null
      const updated = { ...prev, ...updatedFields }
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated))
      return updated
    })
  }

  // Returns true if user has global unrestricted access across ALL schools (superadmin, psds, or admin/AO2 without school restrictions)
  const hasFullAccess = () => {
    if (!admin) return true // Default fallback for unauthenticated / demo
    if (admin.role === 'superadmin' || admin.role === 'psds') return true
    if ((admin.role === 'admin' || (admin.role === 'ao_2' && !!admin.district_name)) && (!admin.assigned_school_ids || admin.assigned_school_ids.length === 0)) {
      return true
    }
    return !admin.assigned_school_ids || admin.assigned_school_ids.length === 0
  }

  const getPermittedSchoolIds = (allSchoolIds: string[] = []) => {
    if (hasFullAccess()) return allSchoolIds
    return admin?.assigned_school_ids || []
  }

  const isSchoolPermitted = (schoolId: string, allSchoolIds: string[] = []) => {
    if (!schoolId) return true
    if (hasFullAccess()) return true
    const permitted = getPermittedSchoolIds(allSchoolIds)
    return permitted.includes(schoolId)
  }

  const getPermittedSchools = <T extends { id: string }>(schools: T[]): T[] => {
    if (hasFullAccess()) return schools
    const permittedIds = getPermittedSchoolIds(schools.map(s => s.id))
    return schools.filter(s => permittedIds.includes(s.id))
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
        updateAdminProfile,
        hasFullAccess,
        getPermittedSchoolIds,
        isSchoolPermitted,
        getPermittedSchools,
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
