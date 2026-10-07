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
  canEditData: (targetSchoolId?: string, targetGradeId?: string, targetSubjectId?: string) => boolean
  canEditGrades: (targetSchoolId?: string, targetGradeId?: string, targetSubjectId?: string) => boolean
  isReadOnlyUser: () => boolean
  isDistrictAdminAO2: () => boolean
  getPermittedSchoolIds: (allSchoolIds?: string[]) => string[]
  isSchoolPermitted: (schoolId: string, allSchoolIds?: string[]) => boolean
  getPermittedSchools: <T extends { id: string }>(schools: T[]) => T[]
  getPermittedGradeLevels: <T extends { id: string }>(gradeLevels: T[]) => T[]
  getPermittedLearningAreas: <T extends { id: string }>(learningAreas: T[], targetGradeId?: string) => T[]
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

  useEffect(() => {
    if (!admin) return
    const now = new Date().toISOString()
    if (!admin.last_seen_at || Date.now() - new Date(admin.last_seen_at).getTime() > 60000) {
      setAdmin(prev => (prev ? { ...prev, last_seen_at: now } : null))
    }

    const interval = setInterval(() => {
      setAdmin(prev => (prev ? { ...prev, last_seen_at: new Date().toISOString() } : null))
    }, 45000)

    return () => clearInterval(interval)
  }, [admin?.id])

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

  // Returns true if user is a read-only inspector (PSDS or School Head)
  const isReadOnlyUser = () => {
    if (!admin) return false
    return admin.role === 'psds' || admin.role === 'school_head'
  }

  // Returns true if user is an AO II assigned to district (acting like System Administrator for that district)
  const isDistrictAdminAO2 = () => {
    if (!admin) return false
    return admin.role === 'ao_2' && Boolean(admin.district_name) && (!admin.assigned_school_ids || admin.assigned_school_ids.length === 0)
  }

  // Returns true if user has global unrestricted access across ALL schools
  const hasFullAccess = () => {
    if (!admin) return true // Fallback for unauthenticated
    // Superadmin has full unrestricted access
    if (admin.role === 'superadmin') return true
    // If the user has assigned schools, they are strictly restricted to their assigned schools
    if (admin.assigned_school_ids && admin.assigned_school_ids.length > 0) {
      return false
    }
    // Users without assigned school restrictions
    if (admin.role === 'admin' || isDistrictAdminAO2()) return true
    if (admin.role === 'psds') return true
    return false
  }

  // Evaluates whether current user can Add, Edit, Delete, or Update data for a target school, grade, and subject
  const canEditData = (targetSchoolId?: string, targetGradeId?: string, targetSubjectId?: string) => {
    if (!admin) return true // Default fallback
    if (isReadOnlyUser()) return false // PSDS and School Heads are STRICTLY View-Only (Read-Only)

    // Superadmin has full CRUD access
    if (admin.role === 'superadmin') return true

    // Check school assignment boundary: If user has assigned schools, must belong to assigned schools
    if (admin.assigned_school_ids && admin.assigned_school_ids.length > 0) {
      if (targetSchoolId && !admin.assigned_school_ids.includes(targetSchoolId)) {
        return false
      }
    }

    if (admin.role === 'admin' || isDistrictAdminAO2()) return true

    // Standard AO II: Full CRUD access on assigned schools
    if (admin.role === 'ao_2') {
      if (!targetSchoolId || !admin.assigned_school_ids || admin.assigned_school_ids.length === 0) return true
      return admin.assigned_school_ids.includes(targetSchoolId)
    }

    // Teacher: Access strictly restricted to assigned school, assigned grade levels, and assigned subjects
    if (admin.role === 'teacher') {
      if (targetSchoolId && admin.assigned_school_ids && admin.assigned_school_ids.length > 0) {
        if (!admin.assigned_school_ids.includes(targetSchoolId)) return false
      }
      if (targetGradeId && admin.assigned_grade_ids && admin.assigned_grade_ids.length > 0) {
        if (!admin.assigned_grade_ids.includes(targetGradeId)) return false
      }
      if (targetSubjectId && admin.assigned_subject_ids && admin.assigned_subject_ids.length > 0) {
        if (!admin.assigned_subject_ids.includes(targetSubjectId)) return false
      }
      return true
    }

    return true
  }

  // Evaluates whether current user can Add, Edit, Delete, or Update GRADES (e-Class Record)
  // STRICT RULE: Only Teachers and Admins (Admin, Superadmin) can add, edit, delete, update grades.
  // AO II, School Head, and PSDS are strictly VIEW-ONLY.
  const canEditGrades = (targetSchoolId?: string, targetGradeId?: string, targetSubjectId?: string) => {
    if (!admin) return false // Unauthenticated is view only

    // AO II, School Head, and PSDS are strictly View-Only for grades
    if (admin.role === 'ao_2' || admin.role === 'school_head' || admin.role === 'psds') {
      return false
    }

    // Superadmin and Admin have full CRUD access on grades
    if (admin.role === 'superadmin' || admin.role === 'admin') {
      return true
    }

    // Teacher: Access strictly restricted to assigned school, assigned grade levels, and assigned subjects
    if (admin.role === 'teacher') {
      if (targetSchoolId && admin.assigned_school_ids && admin.assigned_school_ids.length > 0) {
        if (!admin.assigned_school_ids.includes(targetSchoolId)) return false
      }
      if (targetGradeId && admin.assigned_grade_ids && admin.assigned_grade_ids.length > 0) {
        if (!admin.assigned_grade_ids.includes(targetGradeId)) return false
      }
      if (targetSubjectId && admin.assigned_subject_ids && admin.assigned_subject_ids.length > 0) {
        if (!admin.assigned_subject_ids.includes(targetSubjectId)) return false
      }
      return true
    }

    return false
  }

  const getPermittedSchoolIds = (allSchoolIds: string[] = []) => {
    if (!admin) return allSchoolIds
    // If user has assigned_school_ids, STRICTLY return only their assigned schools
    if (admin.assigned_school_ids && admin.assigned_school_ids.length > 0) {
      return admin.assigned_school_ids
    }
    if (admin.role === 'superadmin' || admin.role === 'admin' || isDistrictAdminAO2() || admin.role === 'psds') {
      return allSchoolIds
    }
    return []
  }

  const isSchoolPermitted = (schoolId: string, allSchoolIds: string[] = []) => {
    if (!schoolId) return true
    if (!admin) return true
    if (admin.assigned_school_ids && admin.assigned_school_ids.length > 0) {
      return admin.assigned_school_ids.includes(schoolId)
    }
    if (admin.role === 'superadmin' || admin.role === 'admin' || isDistrictAdminAO2() || admin.role === 'psds') {
      return true
    }
    return false
  }

  const getPermittedSchools = <T extends { id: string }>(schools: T[]): T[] => {
    if (!admin) return schools
    // STRICT RULE: If user has assigned schools, ONLY return their assigned schools
    if (admin.assigned_school_ids && admin.assigned_school_ids.length > 0) {
      return schools.filter(s => admin.assigned_school_ids!.includes(s.id))
    }
    if (admin.role === 'superadmin' || admin.role === 'admin' || isDistrictAdminAO2() || admin.role === 'psds') {
      return schools
    }
    return []
  }

  // Returns permitted Grade Levels for the current user (filtered by assigned_grade_ids for teachers)
  const getPermittedGradeLevels = <T extends { id: string }>(gradeLevels: T[]): T[] => {
    if (hasFullAccess()) return gradeLevels
    if (admin?.assigned_grade_ids && admin.assigned_grade_ids.length > 0) {
      return gradeLevels.filter(g => admin.assigned_grade_ids!.includes(g.id))
    }
    return gradeLevels
  }

  // Returns permitted Learning Areas / Subjects for the current user
  const getPermittedLearningAreas = <T extends { id: string }>(learningAreas: T[], targetGradeId?: string): T[] => {
    if (hasFullAccess()) return learningAreas
    if (admin?.role === 'teacher') {
      // 1. Check grade-specific subject assignments first
      if (targetGradeId && admin.assigned_grade_subject_ids?.[targetGradeId]?.length) {
        const gradeSubjects = admin.assigned_grade_subject_ids[targetGradeId]
        return learningAreas.filter(la => gradeSubjects.includes(la.id))
      }
      // 2. Check general assigned subjects
      if (admin.assigned_subject_ids && admin.assigned_subject_ids.length > 0) {
        return learningAreas.filter(la => admin.assigned_subject_ids!.includes(la.id))
      }
    }
    if (admin?.assigned_subject_ids && admin.assigned_subject_ids.length > 0) {
      return learningAreas.filter(la => admin.assigned_subject_ids!.includes(la.id))
    }
    return learningAreas
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
        canEditData,
        canEditGrades,
        isReadOnlyUser,
        isDistrictAdminAO2,
        getPermittedSchoolIds,
        isSchoolPermitted,
        getPermittedSchools,
        getPermittedGradeLevels,
        getPermittedLearningAreas,
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
