import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { lisNavGroups } from '@/config/navConfigs'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import {
  fetchLearnerById,
  fetchSchools,
  fetchGradeLevels,
  fetchSections,
  fetchLearningAreas,
  fetchLearnerGradesByLearner,
  saveLearnerGradesBatch,
  upsertLearner,
  insertAuditLog,
} from '@/lib/supabase/queries'
import { calculateAge } from '@/utils/sf1Parser'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { captureGenieOrigin, useGenieModal } from '@/utils/genieAnimation'
import type { Learner, School, GradeLevel, Section, LearningArea, LearnerStatus, LearnerSex, LearnerGrade, SubjectGradeRecord } from '@/types'
import { QRCodeSVG } from 'qrcode.react'
import { SchoolIDCardModal } from '@/components/lis/SchoolIDCardModal'
import { generateLearnerQRCode, getLearnerQRValue } from '@/utils/qrCodeGenerator'
import {
  User,
  GraduationCap,
  Calendar,
  MapPin,
  Users,
  Phone,
  Building2,
  Bookmark,
  Award,
  ShieldCheck,
  Printer,
  Copy,
  Check,
  Edit2,
  ArrowLeft,
  X,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Calculator,
  Save,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  SlidersHorizontal,
  FileText,
  QrCode,
  Download,
  Maximize2
} from 'lucide-react'

const DEFAULT_ELEMENTARY_SUBJECTS = [
  'Filipino',
  'English',
  'Mathematics',
  'Science',
  'Araling Panlipunan (AP)',
  'Edukasyon sa Pagpapakatao (EsP)',
  'EPP / TLE',
  'Music',
  'Arts',
  'Physical Education (PE)',
  'Health',
]

const DEFAULT_SECONDARY_SUBJECTS = [
  'Filipino',
  'English',
  'Mathematics',
  'Science',
  'Araling Panlipunan (AP)',
  'Edukasyon sa Pagpapakatao (EsP)',
  'Technology & Livelihood Education (TLE)',
  'Music',
  'Arts',
  'Physical Education (PE)',
  'Health',
]

export function LearnerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { admin, canEditData, canEditGrades } = useAuth()
  const { toast } = useToast()

  const [learner, setLearner] = useState<Learner | null>(null)
  const [schools, setSchools] = useState<School[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedLrn, setCopiedLrn] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedQR, setCopiedQR] = useState(false)
  const [isIDModalOpen, setIsIDModalOpen] = useState(false)
  const [isQRZoomModalOpen, setIsQRZoomModalOpen] = useState(false)

  const {
    shouldRender: shouldRenderQRZoomModal,
    triggerClose: closeQRZoomModal,
    containerClass: qrZoomModalContainerClass,
    backdropClass: qrZoomModalBackdropClass
  } = useGenieModal(isQRZoomModalOpen, () => setIsQRZoomModalOpen(false))

  const downloadFullQR = () => {
    if (!learner) return
    const svgElement = document.getElementById(`zoomed-qr-svg-${learner.id}`)
    if (!svgElement) return
    const svgData = new XMLSerializer().serializeToString(svgElement)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `QR_${learner.lrn}_${learner.last_name}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast('High-Resolution QR Code downloaded!', 'success')
  }

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'all' | 'personal' | 'academic' | 'address' | 'family' | 'grades'>('all')

  // Academic Grades State
  const [grades, setGrades] = useState<SubjectGradeRecord[]>([])
  const [isEditingGrades, setIsEditingGrades] = useState(false)
  const [isSavingGrades, setIsSavingGrades] = useState(false)

  // Edit Modal State (Personal / Profile Metadata)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Learner>>({})

  const {
    shouldRender: shouldRenderEditModal,
    triggerClose: closeEditModal,
    containerClass: editModalContainerClass,
    backdropClass: editModalBackdropClass
  } = useGenieModal(isEditModalOpen, () => setIsEditModalOpen(false))

  // Helper to load or initialize grades for learner from database
  const initializeLearnerGrades = (
    learnerData: Learner,
    laList: LearningArea[],
    gradeList: GradeLevel[],
    dbGrades: LearnerGrade[] = []
  ) => {
    const storageKey = `sc_learner_grades_${learnerData.id}`
    let cachedGrades: SubjectGradeRecord[] = []
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedGrades = parsed as SubjectGradeRecord[]
        }
      } catch (e) {
        console.warn('Failed to parse cached grades:', e)
      }
    }

    // Determine subject list from learning areas or grade level
    const gradeObj = gradeList.find(g => g.id === learnerData.grade_level_id)
    const isSecondary = (gradeObj?.grade_number || 0) >= 7

    const subjectsToUse = laList.length > 0
      ? laList.map(la => ({ id: la.id, name: la.name }))
      : (isSecondary ? DEFAULT_SECONDARY_SUBJECTS : DEFAULT_ELEMENTARY_SUBJECTS).map((s, idx) => ({ id: `subj-${idx}`, name: s }))

    // Map saved database grades. Do NOT add default fake grades!
    return subjectsToUse.map((subj) => {
      const dbQ1 = dbGrades.find(g => (g.learning_area_id === subj.id || g.learning_area_id === subj.name) && g.quarter === 1)?.quarterly_grade
      const dbQ2 = dbGrades.find(g => (g.learning_area_id === subj.id || g.learning_area_id === subj.name) && g.quarter === 2)?.quarterly_grade
      const dbQ3 = dbGrades.find(g => (g.learning_area_id === subj.id || g.learning_area_id === subj.name) && g.quarter === 3)?.quarterly_grade
      const dbQ4 = dbGrades.find(g => (g.learning_area_id === subj.id || g.learning_area_id === subj.name) && g.quarter === 4)?.quarterly_grade

      const cachedSubj = cachedGrades.find(c => c.subjectName === subj.name || c.id === subj.id)

      const q1 = dbQ1 !== undefined ? dbQ1 : (cachedSubj?.q1 ?? null)
      const q2 = dbQ2 !== undefined ? dbQ2 : (cachedSubj?.q2 ?? null)
      const q3 = dbQ3 !== undefined ? dbQ3 : (cachedSubj?.q3 ?? null)
      const q4 = dbQ4 !== undefined ? dbQ4 : (cachedSubj?.q4 ?? null)

      const quarters = [q1, q2, q3, q4].filter((q): q is number => q !== null && q !== undefined && !isNaN(q))
      const finalRating = quarters.length > 0 ? Math.round(quarters.reduce((a, b) => a + b, 0) / quarters.length) : null
      const remarks = finalRating !== null ? (finalRating >= 75 ? 'Passed' : 'Failed') : 'Pending'

      return {
        id: subj.id,
        learning_area_id: subj.id,
        subjectName: subj.name,
        q1,
        q2,
        q3,
        q4,
        finalRating,
        remarks
      } as SubjectGradeRecord
    })
  }

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [learnerData, schoolsData, gradesData, sectionsData, laData, dbGrades] = await Promise.all([
        fetchLearnerById(id),
        fetchSchools().catch(() => []),
        fetchGradeLevels().catch(() => []),
        fetchSections().catch(() => []),
        fetchLearningAreas(true).catch(() => []),
        fetchLearnerGradesByLearner(id).catch(() => [])
      ])

      if (learnerData) {
        setLearner(learnerData)
        const initialGrades = initializeLearnerGrades(learnerData, laData, gradesData, dbGrades)
        setGrades(initialGrades)
      } else {
        toast('Learner profile not found.', 'error')
      }
      setSchools(schoolsData)
      setGradeLevels(gradesData)
      setSections(sectionsData)
      setLearningAreas(laData)
    } catch (err) {
      console.error('Failed to load learner profile:', err)
      toast('Failed to load learner profile details.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  // Computed helper names
  const schoolObj = useMemo(() => {
    if (!learner) return null
    return schools.find(s => s.id === learner.school_id)
  }, [learner, schools])

  const gradeObj = useMemo(() => {
    if (!learner) return null
    return gradeLevels.find(g => g.id === learner.grade_level_id)
  }, [learner, gradeLevels])

  const sectionObj = useMemo(() => {
    if (!learner) return null
    return sections.find(s => s.id === learner.section_id)
  }, [learner, sections])

  const schoolName = learner?.school_name || schoolObj?.name || 'Assigned School'
  const gradeName = learner?.grade_level_name || gradeObj?.name || (gradeObj?.grade_number !== undefined ? `Grade ${gradeObj.grade_number}` : 'Grade Level')
  const sectionName = learner?.section_name || sectionObj?.name || 'Default Section'

  const computedAge = learner ? (calculateAge(learner.birthdate) || learner.age || 0) : 0

  // General Average Computation
  const computedGeneralAverage = useMemo(() => {
    const validRatings = grades.map(g => g.finalRating).filter((r): r is number => r !== null && r !== undefined && !isNaN(r))
    if (validRatings.length === 0) return null
    const sum = validRatings.reduce((a, b) => a + b, 0)
    return Math.round((sum / validRatings.length) * 10) / 10
  }, [grades])

  const getGeneralAverageDescriptor = (avg: number | null) => {
    if (avg === null) return { text: 'Incomplete Evaluation', color: 'text-slate-500 bg-slate-100 border-slate-200' }
    if (avg >= 90) return { text: 'Outstanding (O)', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' }
    if (avg >= 85) return { text: 'Very Satisfactory (VS)', color: 'text-blue-700 bg-blue-50 border-blue-300' }
    if (avg >= 80) return { text: 'Satisfactory (S)', color: 'text-indigo-700 bg-indigo-50 border-indigo-300' }
    if (avg >= 75) return { text: 'Fairly Satisfactory (FS)', color: 'text-amber-700 bg-amber-50 border-amber-300' }
    return { text: 'Did Not Meet Expectations (DNM)', color: 'text-rose-700 bg-rose-50 border-rose-300' }
  }

  const handleGradeChange = (index: number, quarter: 'q1' | 'q2' | 'q3' | 'q4', value: string) => {
    setGrades(prev => {
      const copy = [...prev]
      const numVal = value.trim() === '' ? null : Math.max(50, Math.min(100, Number(value)))
      copy[index] = { ...copy[index], [quarter]: isNaN(numVal as number) ? null : numVal }

      // Auto recalculate final rating
      const row = copy[index]
      const quarters = [row.q1, row.q2, row.q3, row.q4].filter((q): q is number => q !== null && q !== undefined)
      if (quarters.length > 0) {
        const avg = Math.round(quarters.reduce((a, b) => a + b, 0) / quarters.length)
        row.finalRating = avg
        row.remarks = avg >= 75 ? 'Passed' : 'Failed'
      } else {
        row.finalRating = null
        row.remarks = 'Incomplete'
      }

      return copy
    })
  }

  const handleSaveGrades = async () => {
    if (!learner) return
    if (!canEditGrades(learner.school_id, learner.grade_level_id)) {
      toast('Unauthorized: Only teachers and admins can edit or save grades.', 'error')
      return
    }
    setIsSavingGrades(true)
    try {
      const batch: Partial<LearnerGrade>[] = []
      grades.forEach(subj => {
        const quarters = [
          { q: 1, val: subj.q1 },
          { q: 2, val: subj.q2 },
          { q: 3, val: subj.q3 },
          { q: 4, val: subj.q4 }
        ]
        quarters.forEach(item => {
          if (item.val !== null && item.val !== undefined && !isNaN(item.val)) {
            batch.push({
              learner_id: learner.id,
              school_id: learner.school_id,
              grade_level_id: learner.grade_level_id,
              section_id: learner.section_id,
              learning_area_id: subj.learning_area_id || subj.id,
              school_year: learner.school_year || '2026-2027',
              quarter: item.q,
              quarterly_grade: item.val,
              remarks: item.val >= 75 ? 'Passed' : 'Failed'
            })
          }
        })
      })

      if (batch.length > 0) {
        await saveLearnerGradesBatch(batch)
      }
      localStorage.setItem(`sc_learner_grades_${learner.id}`, JSON.stringify(grades))
      toast('Learner academic grades saved to Supabase successfully!', 'success')
      setIsEditingGrades(false)
    } catch (err) {
      console.error('Failed to save grades:', err)
      toast('Failed to save grades.', 'error')
    } finally {
      setIsSavingGrades(false)
    }
  }

  const handleResetGrades = () => {
    if (!learner) return
    const initial = initializeLearnerGrades(learner, learningAreas, gradeLevels, [])
    setGrades(initial)
    localStorage.removeItem(`sc_learner_grades_${learner.id}`)
    toast('Academic grades cleared.', 'info')
  }

  const handleCopyLRN = () => {
    if (!learner) return
    navigator.clipboard.writeText(learner.lrn)
    setCopiedLrn(true)
    toast('LRN copied to clipboard!', 'info')
    setTimeout(() => setCopiedLrn(false), 2000)
  }

  const handleCopyFullProfile = () => {
    if (!learner) return
    const text = `
LEARNER CUMULATIVE RECORD (DepEd SchoolConnect)
-----------------------------------------------
1. PERSONAL & DEMOGRAPHIC INFORMATION:
LRN: ${learner.lrn}
Full Name: ${learner.last_name}, ${learner.first_name} ${learner.middle_name || ''} ${learner.extension_name || ''}
Sex: ${learner.sex}
Birthdate: ${learner.birthdate} (Age: ${computedAge})
Mother Tongue: ${learner.mother_tongue || 'Filipino / Tagalog'}
IP Community / Ethnic Group: ${learner.ip_group || 'None / Non-IP'}
Religion: ${learner.religion || 'Roman Catholic'}

2. ACADEMIC & ENROLLMENT DETAILS:
School: ${schoolName}
Grade Level: ${gradeName}
Section: ${sectionName}
School Year: ${learner.school_year || '2026 - 2027'}
Status: ${learner.status.toUpperCase()}
4Ps CCT Beneficiary: ${learner.is_4ps_cct ? 'Yes' : 'No'}
Balik-Aral: ${learner.is_balik_aral ? 'Yes' : 'No'}
Special Curricular Program: ${learner.is_ecd_alive_sped ? 'SPED / ECD / ALIVE' : 'General'}

3. RESIDENTIAL & HOME ADDRESS:
House No.: ${learner.address_house_no || 'N/A'}
Street / Sitio: ${learner.address_street || 'N/A'}
Barangay: ${learner.address_barangay || 'N/A'}
City / Municipality: ${learner.address_city_municipality || 'Concepcion'}
Province: ${learner.address_province || 'Tarlac'}
Complete Address: ${[learner.address_house_no, learner.address_street, learner.address_barangay, learner.address_city_municipality, learner.address_province].filter(Boolean).join(', ') || 'N/A'}

4. FAMILY & LEGAL GUARDIAN CONTACT:
Father's Name: ${learner.father_name || 'Not Specified'}
Mother's Maiden Name: ${learner.mother_maiden_name || 'Not Specified'}
Legal Guardian: ${learner.guardian_name || 'Parent / Relative'}
Relationship: ${learner.guardian_relationship || 'Guardian'}
Contact Phone: ${learner.guardian_contact_no || 'N/A'}

5. SCHOOL ACADEMIC GRADES & PERFORMANCE:
General Average: ${computedGeneralAverage ? `${computedGeneralAverage}% (${getGeneralAverageDescriptor(computedGeneralAverage).text})` : 'In Progress'}
-----------------------------------------------
`.trim()

    navigator.clipboard.writeText(text)
    setCopiedAll(true)
    toast('Full learner details copied to clipboard!', 'success')
    setTimeout(() => setCopiedAll(false), 2500)
  }

  const handleOpenEdit = (e?: React.MouseEvent) => {
    if (e) captureGenieOrigin(e)
    if (!learner) return
    setEditForm({ ...learner })
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!learner || !editForm.lrn || !editForm.first_name || !editForm.last_name) {
      toast('Please fill in required learner fields (LRN, First Name, Last Name).', 'error')
      return
    }

    setSavingEdit(true)
    try {
      const updated: Partial<Learner> = {
        ...editForm,
        id: learner.id,
        updated_at: new Date().toISOString()
      }

      await upsertLearner(updated)
      setLearner(prev => prev ? { ...prev, ...updated } as Learner : null)

      if (admin) {
        await insertAuditLog({
          admin_id: admin.id,
          admin_name: admin.full_name,
          action: 'update_learner_profile',
          details: { learner_id: learner.id, lrn: learner.lrn, name: `${learner.last_name}, ${learner.first_name}` }
        })
      }

      toast('Learner profile updated successfully!', 'success')
      closeEditModal()
    } catch (err) {
      console.error('Failed to update learner profile:', err)
      toast('Failed to save learner updates.', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const getStatusBadgeColor = (status: LearnerStatus) => {
    switch (status) {
      case 'enrolled':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'transferred_in':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'transferred_out':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'dropped':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'promoted':
        return 'bg-teal-50 text-teal-700 border-teal-200'
      case 'graduated':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200'
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  if (loading) {
    return (
      <SchoolConnectLayout systemTitle="Learner Profile Details" navGroups={lisNavGroups}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <DepEdSpinner size="lg" />
        </div>
      </SchoolConnectLayout>
    )
  }

  if (!learner) {
    return (
      <SchoolConnectLayout systemTitle="Learner Not Found" navGroups={lisNavGroups}>
        <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Learner Profile Not Found</h2>
          <p className="text-xs text-slate-500">
            The requested Learner ID or Reference Number does not exist in the database or may have been removed.
          </p>
          <div className="pt-2">
            <Link
              to="/lis/directory"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all"
            >
              <ArrowLeft size={14} />
              <span>Back to Master Directory</span>
            </Link>
          </div>
        </div>
      </SchoolConnectLayout>
    )
  }

  const fullAddress = [
    learner.address_house_no && `House #${learner.address_house_no}`,
    learner.address_street,
    learner.address_barangay && `Brgy. ${learner.address_barangay}`,
    learner.address_city_municipality,
    learner.address_province
  ].filter(Boolean).join(', ') || 'No residential address on file'

  return (
    <SchoolConnectLayout
      systemTitle="Learner Information System"
      systemSubtitle="Student Cumulative Record & SF1 Master Profile"
      navGroups={lisNavGroups}
    >
      {/* Print Specific CSS Styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; font-size: 11pt; }
          .no-print { display: none !important; }
          .print-card { border: 1px solid #94a3b8 !important; box-shadow: none !important; background: white !important; page-break-inside: avoid; }
        }
      `}</style>

      <div className="flex-1 w-full space-y-6 pb-16 animate-fade-in font-sans">
        
        {/* TOP NAVIGATION BREADCRUMB & QUICK ACTION TOOLBAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 flex-wrap">
            <Link to="/portal" className="hover:text-blue-600 transition-colors">Hub</Link>
            <ChevronRight size={13} className="text-slate-400 shrink-0" />
            <Link to="/lis/directory" className="hover:text-blue-600 transition-colors">LIS Master Directory</Link>
            <ChevronRight size={13} className="text-slate-400 shrink-0" />
            <span className="text-slate-900 font-bold font-mono">LRN {learner.lrn}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            <button
              onClick={() => setIsIDModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="View & Print Official DepEd Student ID Card with QR Code"
            >
              <QrCode size={14} />
              <span>Print Student ID & QR</span>
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold shadow-2xs hover:bg-slate-50 transition-all cursor-pointer"
              title="Print Official Profile & Report Card"
            >
              <Printer size={14} className="text-slate-500" />
              <span>Print Form 137 / Profile</span>
            </button>

            <button
              onClick={handleCopyFullProfile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold shadow-2xs hover:bg-slate-50 transition-all cursor-pointer"
              title="Copy all details to clipboard"
            >
              {copiedAll ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-slate-500" />}
              <span>{copiedAll ? 'Copied Full Record!' : 'Copy Info'}</span>
            </button>

            {canEditData(learner.school_id, learner.grade_level_id, learner.section_id) && (
              <button
                onClick={handleOpenEdit}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Edit2 size={14} />
                <span>Edit Profile</span>
              </button>
            )}

            <button
              onClick={() => navigate('/lis/directory')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-all cursor-pointer"
              title="Return to Master Directory"
            >
              <ArrowLeft size={14} />
              <span>Back to Directory</span>
            </button>
          </div>
        </div>

        {/* HERO LEARNER HEADER (Clean Minimalist Design) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs print-card">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            
            {/* Left: Avatar + Identity */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-1 bg-slate-50 border ${
                  learner.sex === 'Male' ? 'border-blue-200' : 'border-pink-200'
                } flex items-center justify-center`}>
                  <img
                    src={learner.sex === 'Male' ? '/images/clay/avatar_boy.jpg' : '/images/clay/avatar_girl.jpg'}
                    alt={`${learner.first_name} ${learner.last_name}`}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                    className="w-full h-full rounded-xl object-cover"
                  />
                  <User className="w-8 h-8 text-slate-400 hidden" />
                </div>
                <span className={`absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold border ${
                  learner.sex === 'Male' ? 'bg-blue-600 text-white border-white' : 'bg-pink-600 text-white border-white'
                }`}>
                  {learner.sex === 'Male' ? 'Male' : 'Female'}
                </span>
              </div>

              <div className="space-y-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 truncate">
                  {learner.last_name}, {learner.first_name} {learner.middle_name || ''} {learner.extension_name || ''}
                </h1>

                {/* Badges & Meta */}
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <div
                    onClick={handleCopyLRN}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono font-bold text-slate-800 transition-all cursor-pointer"
                    title="Click to copy LRN"
                  >
                    <span>LRN: {learner.lrn}</span>
                    {copiedLrn ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="text-slate-400" />}
                  </div>

                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusBadgeColor(learner.status)}`}>
                    {learner.status.replace('_', ' ')}
                  </span>

                  {learner.is_4ps_cct && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      4Ps CCT
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 font-medium flex items-center gap-2 pt-1 flex-wrap">
                  <span className="font-semibold text-slate-700">{schoolName}</span>
                  <span>•</span>
                  <span>{gradeName} — {sectionName}</span>
                  <span>•</span>
                  <span>SY {learner.school_year || '2026 - 2027'}</span>
                </p>
              </div>
            </div>

            {/* Right: Minimalist Quick Stats */}
            <div className="flex items-center gap-6 divide-x divide-slate-100 text-left no-print">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Age</span>
                <span className="text-base font-black text-slate-900 block mt-0.5">{computedAge} yrs</span>
                <span className="text-[11px] text-slate-500 block">{learner.birthdate}</span>
              </div>

              <div className="pl-6">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Gen Average</span>
                <span className="text-base font-black text-blue-600 block mt-0.5">
                  {computedGeneralAverage !== null ? `${computedGeneralAverage}%` : 'Pending'}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {computedGeneralAverage !== null ? (computedGeneralAverage >= 75 ? 'Passed' : 'Needs Review') : 'In Progress'}
                </span>
              </div>

              <div className="pl-6">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Contact Person</span>
                <span className="text-xs font-bold text-slate-800 block mt-0.5 truncate max-w-[130px]">
                  {learner.guardian_name || learner.father_name || 'Guardian'}
                </span>
                <span className="text-[11px] text-slate-500 font-mono block">
                  {learner.guardian_contact_no || 'No Contact #'}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* SECTION NAV FILTER TABS (Minimalist Pill Style) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-print border-b border-slate-200">
          {[
            { key: 'all', label: 'All Details' },
            { key: 'personal', label: '1. Personal & Demographics' },
            { key: 'academic', label: '2. Academic & Enrollment' },
            { key: 'address', label: '3. Address' },
            { key: 'family', label: '4. Family & Guardian' },
            { key: 'grades', label: '5. Academic Grades' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* COMPREHENSIVE DATA SECTIONS (Clean Minimal Text Layout) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-10 print-card">

          {/* 1. PERSONAL & DEMOGRAPHIC PROFILE */}
          {(activeTab === 'all' || activeTab === 'personal') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  1. Personal & Demographic Information
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">First Name</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{learner.first_name}</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Middle Name</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{learner.middle_name || '—'}</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Last Name</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{learner.last_name}</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Extension (Jr/III)</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{learner.extension_name || 'None'}</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Sex & Gender</span>
                  <span className={`text-sm font-semibold block mt-0.5 ${learner.sex === 'Male' ? 'text-blue-600' : 'text-pink-600'}`}>
                    {learner.sex === 'Male' ? 'Male (Boy)' : 'Female (Girl)'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Date of Birth & Age</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{learner.birthdate}</span>
                  <span className="text-[11px] text-slate-400 block">{computedAge} years old</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Mother Tongue</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{learner.mother_tongue || 'Tagalog / Filipino'}</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Ethnic / IP Group</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{learner.ip_group || 'None / Non-IP'}</span>
                </div>

                <div className="col-span-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Religion / Faith</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{learner.religion || 'Roman Catholic / Christianity'}</span>
                </div>
              </div>

              {/* Minimal QR Code Row */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="relative group/qr">
                    <button
                      type="button"
                      onClick={() => setIsQRZoomModalOpen(true)}
                      title="Click to enlarge QR Code"
                      className="p-2 bg-white rounded-xl border-2 border-slate-200 hover:border-blue-500 shrink-0 shadow-xs cursor-zoom-in hover:shadow-md transition-all relative block text-left group"
                    >
                      <QRCodeSVG
                        id={`profile-qr-${learner.id}`}
                        value={getLearnerQRValue(learner)}
                        size={96}
                        level="L"
                        includeMargin={true}
                      />
                      <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-1 rounded-full shadow-md flex items-center justify-center">
                        <Maximize2 size={11} />
                      </div>
                    </button>

                    {/* Floating Hover-Enlarged Preview Tooltip Card */}
                    <div className="hidden group-hover/qr:flex flex-col items-center absolute -top-8 left-28 z-50 bg-white p-4 rounded-2xl shadow-2xl border-2 border-blue-500 animate-in fade-in zoom-in-95 duration-150 pointer-events-none w-64 text-center">
                      <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Maximize2 size={10} />
                        Enlarged QR Code
                      </span>
                      <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs inline-block">
                        <QRCodeSVG
                          value={getLearnerQRValue(learner)}
                          size={190}
                          level="L"
                          includeMargin={true}
                        />
                      </div>
                      <span className="text-xs font-mono font-black text-blue-900 mt-2">LRN: {learner.lrn}</span>
                      <span className="text-[10px] font-semibold text-slate-700">{learner.last_name?.toUpperCase()}, {learner.first_name}</span>
                      <span className="text-[9px] text-blue-600 font-medium mt-1">Click QR for full screen view</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Learner QR Code</span>
                    <span className="text-xs font-mono font-bold text-blue-700 block">
                      LRN: {learner.lrn}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsQRZoomModalOpen(true)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 mt-0.5 hover:underline cursor-pointer"
                    >
                      <Maximize2 size={11} />
                      Click to Enlarge
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const qrVal = getLearnerQRValue(learner)
                      navigator.clipboard.writeText(qrVal)
                      setCopiedQR(true)
                      toast('Learner details copied to clipboard!', 'success')
                      setTimeout(() => setCopiedQR(false), 2000)
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-all inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedQR ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedQR ? 'Copied' : 'Copy Text'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsIDModalOpen(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-semibold text-white shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3 h-3" />
                    Print School ID
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. ACADEMIC & ENROLLMENT DETAILS */}
          {(activeTab === 'all' || activeTab === 'academic') && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  2. Academic & Enrollment Placement
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Assigned School</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5 truncate">{schoolName}</span>
                  <span className="text-[11px] text-slate-400 block">ID: {learner.school_id}</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">School Year</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{learner.school_year || '2026 - 2027'}</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Grade Level</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{gradeName}</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Class Section</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{sectionName}</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Enrollment Status</span>
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border mt-1 ${getStatusBadgeColor(learner.status)}`}>
                    {learner.status.replace('_', ' ')}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Program Type</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">
                    {learner.is_balik_aral ? 'Balik-Aral' : 'Regular Enrollee'}
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    {learner.is_ecd_alive_sped ? 'SPED / ECD / ALIVE' : 'General'}
                  </span>
                </div>
              </div>

              {learner.remarks && (
                <div className="pt-2 text-xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Remarks</span>
                  <p className="text-slate-700 font-medium mt-0.5">{learner.remarks}</p>
                </div>
              )}
            </div>
          )}

          {/* 3. RESIDENTIAL & HOME ADDRESS */}
          {(activeTab === 'all' || activeTab === 'address') && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  3. Residential & Home Address
                </h3>
              </div>

              <div className="text-xs space-y-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Complete Home Address</span>
                  <p className="text-sm font-semibold text-slate-900 leading-relaxed mt-0.5">{fullAddress}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-y-3 gap-x-4 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">House / Lot #</span>
                    <span className="text-xs font-semibold text-slate-800 block mt-0.5">{learner.address_house_no || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Street / Sitio</span>
                    <span className="text-xs font-semibold text-slate-800 block mt-0.5">{learner.address_street || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Barangay</span>
                    <span className="text-xs font-semibold text-slate-800 block mt-0.5">{learner.address_barangay || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Municipality / City</span>
                    <span className="text-xs font-semibold text-slate-800 block mt-0.5">{learner.address_city_municipality || 'Concepcion'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Province</span>
                    <span className="text-xs font-semibold text-slate-800 block mt-0.5">{learner.address_province || 'Tarlac'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. PARENTS & GUARDIAN CONTACT DETAILS */}
          {(activeTab === 'all' || activeTab === 'family') && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  4. Family & Legal Guardian Contact
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Father's Name</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{learner.father_name || 'Not Specified'}</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Mother's Maiden Name</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{learner.mother_maiden_name || 'Not Specified'}</span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Legal Guardian</span>
                  <span className="text-sm font-semibold text-slate-900 block mt-0.5">{learner.guardian_name || 'Parent / Relative'}</span>
                  <span className="text-[11px] text-slate-400 block">{learner.guardian_relationship || 'Guardian'}</span>
                </div>

                <div className="col-span-2 sm:col-span-3 pt-2 border-t border-slate-100 flex items-center gap-4">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Emergency Contact Phone</span>
                    {learner.guardian_contact_no ? (
                      <a
                        href={`tel:${learner.guardian_contact_no}`}
                        className="text-sm font-bold text-blue-600 hover:underline inline-flex items-center gap-1.5 mt-0.5"
                      >
                        <Phone size={13} />
                        <span>{learner.guardian_contact_no}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 block mt-0.5">No phone number on record</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. SCHOOL ACADEMIC GRADES & PERFORMANCE (SF9 / FORM 137 REPORT CARD) */}
          {(activeTab === 'all' || activeTab === 'grades') && (
            <div className="space-y-4 pt-2">
              
              {/* Header with Title & Action Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    5. School Academic Grades & Performance (SF9 / Form 137)
                  </h3>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto no-print">
                  {isEditingGrades ? (
                    <>
                      <button
                        onClick={handleResetGrades}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1 cursor-pointer"
                        title="Reset to benchmark values"
                      >
                        <RotateCcw size={12} />
                        <span>Reset</span>
                      </button>
                      <button
                        onClick={handleSaveGrades}
                        disabled={isSavingGrades}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Save size={13} />
                        <span>{isSavingGrades ? 'Saving...' : 'Save Grades'}</span>
                      </button>
                    </>
                  ) : (
                    canEditGrades(learner.school_id, learner.grade_level_id) && (
                      <button
                        onClick={() => setIsEditingGrades(true)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <SlidersHorizontal size={13} />
                        <span>Edit Quarterly Grades</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Minimal General Average Line */}
              <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl text-xs flex-wrap">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">General Average</span>
                    <span className="text-base font-black text-slate-900 block">
                      {computedGeneralAverage !== null ? `${computedGeneralAverage}%` : 'In Progress'}
                    </span>
                  </div>
                  <div className="pl-4 border-l border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">DepEd Qualitative Descriptor</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border mt-0.5 ${getGeneralAverageDescriptor(computedGeneralAverage).color}`}>
                      {getGeneralAverageDescriptor(computedGeneralAverage).text}
                    </span>
                  </div>
                </div>

                <div className="text-slate-500 text-[11px]">
                  Passing Grade: <strong className="text-slate-700">75%</strong>
                </div>
              </div>

              {/* OFFICIAL REPORT CARD TABLE */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-4">Learning Areas / Subjects</th>
                      <th className="py-2.5 px-3 text-center w-16">Q1</th>
                      <th className="py-2.5 px-3 text-center w-16">Q2</th>
                      <th className="py-2.5 px-3 text-center w-16">Q3</th>
                      <th className="py-2.5 px-3 text-center w-16">Q4</th>
                      <th className="py-2.5 px-3 text-center w-24 bg-blue-50/40">Final Rating</th>
                      <th className="py-2.5 px-4 text-center w-28">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-900">
                    {grades.map((grade, idx) => (
                      <tr key={grade.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <BookOpen size={14} className="text-slate-400 shrink-0" />
                            <span>{grade.subjectName}</span>
                          </div>
                        </td>

                        {/* Quarter 1 */}
                        <td className="py-2 px-2 text-center font-mono font-bold">
                          {isEditingGrades ? (
                            <input
                              type="number"
                              min={50}
                              max={100}
                              value={grade.q1 ?? ''}
                              onChange={e => handleGradeChange(idx, 'q1', e.target.value)}
                              className="w-14 py-1 text-center font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 bg-white"
                            />
                          ) : (
                            <span>{grade.q1 ?? '—'}</span>
                          )}
                        </td>

                        {/* Quarter 2 */}
                        <td className="py-2 px-2 text-center font-mono font-bold">
                          {isEditingGrades ? (
                            <input
                              type="number"
                              min={50}
                              max={100}
                              value={grade.q2 ?? ''}
                              onChange={e => handleGradeChange(idx, 'q2', e.target.value)}
                              className="w-14 py-1 text-center font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 bg-white"
                            />
                          ) : (
                            <span>{grade.q2 ?? '—'}</span>
                          )}
                        </td>

                        {/* Quarter 3 */}
                        <td className="py-2 px-2 text-center font-mono font-bold">
                          {isEditingGrades ? (
                            <input
                              type="number"
                              min={50}
                              max={100}
                              value={grade.q3 ?? ''}
                              onChange={e => handleGradeChange(idx, 'q3', e.target.value)}
                              className="w-14 py-1 text-center font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 bg-white"
                            />
                          ) : (
                            <span>{grade.q3 ?? '—'}</span>
                          )}
                        </td>

                        {/* Quarter 4 */}
                        <td className="py-2 px-2 text-center font-mono font-bold">
                          {isEditingGrades ? (
                            <input
                              type="number"
                              min={50}
                              max={100}
                              value={grade.q4 ?? ''}
                              onChange={e => handleGradeChange(idx, 'q4', e.target.value)}
                              className="w-14 py-1 text-center font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 bg-white"
                            />
                          ) : (
                            <span>{grade.q4 ?? '—'}</span>
                          )}
                        </td>

                        {/* Final Rating */}
                        <td className="py-3 px-3 text-center font-mono font-black text-sm bg-blue-50/40 text-blue-900">
                          {grade.finalRating !== null ? `${grade.finalRating}` : '—'}
                        </td>

                        {/* Remarks */}
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            grade.remarks === 'Passed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : grade.remarks === 'Failed'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {grade.remarks}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {/* GENERAL AVERAGE SUMMARY ROW */}
                    <tr className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-slate-900">
                      <td className="py-3.5 px-4 uppercase tracking-wider text-xs">
                        General Average (All Learning Areas)
                      </td>
                      <td colSpan={4} className="py-3.5 px-3 text-right text-[11px] text-slate-500 font-bold">
                        Computed Final Average:
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-base font-black bg-blue-100 text-blue-900 border-x border-blue-200">
                        {computedGeneralAverage !== null ? `${computedGeneralAverage}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase border ${
                          computedGeneralAverage !== null && computedGeneralAverage >= 75
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-rose-600 text-white border-rose-700'
                        }`}>
                          {computedGeneralAverage !== null && computedGeneralAverage >= 75 ? 'PASSED' : 'EVALUATION'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Grading Legend Reference */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-700">DepEd Grading Scale:</span>
                <span>90-100: Outstanding (O)</span>
                <span>85-89: Very Satisfactory (VS)</span>
                <span>80-84: Satisfactory (S)</span>
                <span>75-79: Fairly Satisfactory (FS)</span>
                <span>Below 75: Did Not Meet Expectations (DNM)</span>
              </div>

            </div>
          )}

        </div>

        {/* AUDIT RECORD FOOTER */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>Official DepEd LIS Record • Database ID: <code className="font-mono text-slate-700">{learner.id}</code></span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span>Registered: {new Date(learner.created_at).toLocaleDateString()}</span>
            <span>•</span>
            <span>Last Modified: {new Date(learner.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

      </div>

      {/* EDIT MODAL DIALOG */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-150 relative z-50 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Edit2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Learner Information</h3>
                  <p className="text-[11px] text-slate-500">Update official record details in Supabase database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* LRN & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    LRN (12 Digits) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={editForm.lrn || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, lrn: e.target.value.replace(/\D/g, '') }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Enrollment Status *
                  </label>
                  <select
                    value={editForm.status || 'enrolled'}
                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as LearnerStatus }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="enrolled">Enrolled</option>
                    <option value="transferred_in">Transferred In</option>
                    <option value="transferred_out">Transferred Out</option>
                    <option value="dropped">Dropped</option>
                    <option value="promoted">Promoted</option>
                    <option value="graduated">Graduated</option>
                  </select>
                </div>
              </div>

              {/* Name Details */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.first_name || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={editForm.middle_name || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, middle_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Ext. (Jr/III)
                  </label>
                  <input
                    type="text"
                    value={editForm.extension_name || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, extension_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.last_name || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Sex, Birthdate, Mother Tongue */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Sex *
                  </label>
                  <select
                    value={editForm.sex || 'Male'}
                    onChange={e => setEditForm(prev => ({ ...prev, sex: e.target.value as LearnerSex }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Birthdate (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={editForm.birthdate || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, birthdate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Mother Tongue
                  </label>
                  <input
                    type="text"
                    value={editForm.mother_tongue || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, mother_tongue: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Parents & Guardian */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Father's Name
                  </label>
                  <input
                    type="text"
                    value={editForm.father_name || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, father_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Mother's Maiden Name
                  </label>
                  <input
                    type="text"
                    value={editForm.mother_maiden_name || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, mother_maiden_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Guardian Name
                  </label>
                  <input
                    type="text"
                    value={editForm.guardian_name || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, guardian_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Guardian Contact #
                  </label>
                  <input
                    type="text"
                    value={editForm.guardian_contact_no || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, guardian_contact_no: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Address Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    House # / Street
                  </label>
                  <input
                    type="text"
                    value={editForm.address_street || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, address_street: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Barangay
                  </label>
                  <input
                    type="text"
                    value={editForm.address_barangay || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, address_barangay: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    City / Municipality
                  </label>
                  <input
                    type="text"
                    value={editForm.address_city_municipality || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, address_city_municipality: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Checkbox Flags */}
              <div className="flex items-center gap-6 pt-2 border-t border-slate-100">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_4ps_cct ?? false}
                    onChange={e => setEditForm(prev => ({ ...prev, is_4ps_cct: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-700">4Ps CCT Beneficiary</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_balik_aral ?? false}
                    onChange={e => setEditForm(prev => ({ ...prev, is_balik_aral: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Balik-Aral</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => closeEditModal()}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? <span>Saving...</span> : <span>Save Changes</span>}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Enlarged QR Code Modal */}
      {isQRZoomModalOpen && learner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsQRZoomModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden p-6 text-center select-none animate-in zoom-in-95 duration-150 relative z-50"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="text-left">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-blue-600" />
                  Learner QR Code
                </h3>
                <p className="text-[11px] text-slate-500">Scan with any smartphone camera</p>
              </div>
              <button
                type="button"
                onClick={() => setIsQRZoomModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Enlarged QR Code Display */}
            <div className="py-5 flex flex-col items-center justify-center bg-slate-50/80 rounded-2xl my-3.5 border border-slate-100">
              <div className="p-3.5 bg-white rounded-2xl shadow-md border border-slate-200/80 inline-block">
                <QRCodeSVG
                  id={`zoomed-qr-svg-${learner.id}`}
                  value={getLearnerQRValue(learner)}
                  size={220}
                  level="L"
                  includeMargin={true}
                />
              </div>
              <div className="mt-3 text-center px-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Learner Reference Number</span>
                <span className="text-base font-mono font-black text-blue-900 tracking-wider block mt-0.5">{learner.lrn}</span>
                <span className="text-xs font-bold text-slate-800 block mt-1">
                  {learner.last_name?.toUpperCase()}, {learner.first_name} {learner.middle_name || ''}
                </span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                  {learner.grade_level_name || 'Grade Level'} — {learner.section_name || 'Section'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const qrVal = getLearnerQRValue(learner)
                  navigator.clipboard.writeText(qrVal)
                  toast('Learner details copied to clipboard!', 'success')
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy size={13} />
                Copy Text
              </button>
              <button
                type="button"
                onClick={downloadFullQR}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download size={13} />
                Download SVG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* School ID Card Print & QR Modal */}
      {learner && (
        <SchoolIDCardModal
          isOpen={isIDModalOpen}
          onClose={() => setIsIDModalOpen(false)}
          learner={learner}
        />
      )}

    </SchoolConnectLayout>
  )
}
