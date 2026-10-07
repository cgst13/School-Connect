import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authenticateWithUserTable, fetchAdminProfile } from '@/lib/supabase/queries'
import { getAllocatedLearningAreasForGrade } from '@/utils/gradeUtils'
import type { AdminProfile, GradeLevel } from '@/types'

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
  getPermittedLearningAreas: <T extends { id: string; is_active?: boolean; name?: string }>(
    learningAreas: T[],
    targetGradeId?: string,
    learningAreaGrades?: { learning_area_id: string; grade_level_id: string }[],
    gradeLevels?: GradeLevel[]
  ) => T[]
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

  // Returns true if user is an AO II assigned to district (acting like System Administrator for that district / all schools)
  const isDistrictAdminAO2 = () => {
    if (!admin) return false
    return (admin.role === 'ao_2' && Boolean(admin.district_name)) || (admin.role === 'ao_2' && (!admin.assigned_school_ids || admin.assigned_school_ids.length === 0))
  }

  // Returns true if user has global unrestricted access across ALL schools
  const hasFullAccess = () => {
    if (!admin) return true // Fallback for unauthenticated
    // Superadmin and Admin have full unrestricted access
    if (admin.role === 'superadmin' || admin.role === 'admin') return true
    // AO II with district assignment gets full admin access across all schools
    if (isDistrictAdminAO2()) return true
    // PSDS has district-wide visibility
    if (admin.role === 'psds') return true
    // If the user has assigned schools (Teachers, School Heads), they are strictly restricted to their assigned schools
    if (admin.assigned_school_ids && admin.assigned_school_ids.length > 0) {
      return false
    }
    return false
  }

  // Evaluates whether current user can Add, Edit, Delete, or Update data for a target school, grade, and subject
  const canEditData = (targetSchoolId?: string, targetGradeId?: string, targetSubjectId?: string) => {
    if (!admin) return true // Default fallback
    if (isReadOnlyUser()) return false // PSDS and School Heads are STRICTLY View-Only (Read-Only)

    // Superadmin, Admin, and District AO II have full CRUD access across all schools
    if (admin.role === 'superadmin' || admin.role === 'admin' || isDistrictAdminAO2()) return true

    // Check school assignment boundary: If user has assigned schools, must belong to assigned schools
    if (admin.assigned_school_ids && admin.assigned_school_ids.length > 0) {
      if (targetSchoolId && !admin.assigned_school_ids.includes(targetSchoolId)) {
        return false
      }
    }

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
    // Superadmin, Admin, PSDS, and AO with district access have full access to all schools
    if (admin.role === 'superadmin' || admin.role === 'admin' || isDistrictAdminAO2() || admin.role === 'psds') {
      return allSchoolIds
    }
    // If user has assigned_school_ids (e.g. Teacher, School Head), STRICTLY return only their assigned schools
    if (admin.assigned_school_ids && admin.assigned_school_ids.length > 0) {
      return admin.assigned_school_ids
    }
    return allSchoolIds
  }

  const isSchoolPermitted = (schoolId: string, allSchoolIds: string[] = []) => {
    if (!schoolId) return true
    if (!admin) return true
    if (admin.role === 'superadmin' || admin.role === 'admin' || isDistrictAdminAO2() || admin.role === 'psds') {
      return true
    }
    if (admin.assigned_school_ids && admin.assigned_school_ids.length > 0) {
      return admin.assigned_school_ids.includes(schoolId)
    }
    return true
  }

  const getPermittedSchools = <T extends { id: string; district?: string }>(schools: T[]): T[] => {
    if (!admin) return schools
    // Superadmin, Admin, PSDS, and AO with district access have access to all schools (or district schools if matching)
    if (admin.role === 'superadmin' || admin.role === 'admin' || isDistrictAdminAO2() || admin.role === 'psds') {
      if (admin.district_name) {
        const districtSchools = schools.filter(s => s.district && s.district.toLowerCase() === admin.district_name!.toLowerCase())
        return districtSchools.length > 0 ? districtSchools : schools
      }
      return schools
    }
    // Teachers and School Heads with assigned schools are strictly restricted to their assigned schools
    if (admin.assigned_school_ids && admin.assigned_school_ids.length > 0) {
      return schools.filter(s => admin.assigned_school_ids!.includes(s.id))
    }
    return schools
  }

  // Returns permitted Grade Levels for the current user (filtered by assigned_grade_ids for teachers)
  const getPermittedGradeLevels = <T extends { id: string }>(gradeLevels: T[]): T[] => {
    if (hasFullAccess()) return gradeLevels
    if (admin?.assigned_grade_ids && admin.assigned_grade_ids.length > 0) {
      return gradeLevels.filter(g => admin.assigned_grade_ids!.includes(g.id))
    }
    return gradeLevels
  }

  // Returns permitted Learning Areas / Subjects for the current user and target grade level
  const getPermittedLearningAreas = <T extends { id: string; is_active?: boolean; name?: string }>(
    learningAreas: T[],
    targetGradeId?: string,
    learningAreaGrades?: { learning_area_id: string; grade_level_id: string }[],
    gradeLevels?: GradeLevel[]
  ): T[] => {
    // 1. First, narrow down learning areas based on Learning Areas & Subject Allocation matrix for the grade
    let gradeScopedAreas = learningAreas
    if (targetGradeId && targetGradeId !== 'all' && learningAreaGrades && learningAreaGrades.length > 0) {
      gradeScopedAreas = getAllocatedLearningAreasForGrade(learningAreas, targetGradeId, learningAreaGrades, gradeLevels)
    }

    if (hasFullAccess()) return gradeScopedAreas

    if (admin?.role === 'teacher') {
      // 1. Check grade-specific subject assignments first
      if (targetGradeId && admin.assigned_grade_subject_ids?.[targetGradeId]?.length) {
        const gradeSubjects = admin.assigned_grade_subject_ids[targetGradeId]
        return gradeScopedAreas.filter(la => gradeSubjects.includes(la.id))
      }
      // 2. Check general assigned subjects
      if (admin.assigned_subject_ids && admin.assigned_subject_ids.length > 0) {
        return gradeScopedAreas.filter(la => admin.assigned_subject_ids!.includes(la.id))
      }
    }
    if (admin?.assigned_subject_ids && admin.assigned_subject_ids.length > 0) {
      return gradeScopedAreas.filter(la => admin.assigned_subject_ids!.includes(la.id))
    }
    return gradeScopedAreas
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
