import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  Grid,
  Users,
  Building2,
  ShieldCheck,
  LogOut,
  Search,
  Lock,
  ChevronRight,
  BookOpen,
  Calendar,
  Clock,
  ScrollText,
  Settings,
  Bell,
  CheckSquare,
  Square,
  Megaphone,
  Pin,
  Plus,
  ChevronDown,
  Upload,
  Eye,
  EyeOff,
  User,
  Pencil,
  Archive,
  ArchiveRestore,
  MapPin,
  X,
  CalendarDays,
  Target,
  Globe,
  School as SchoolIcon,
  Briefcase,
  UserCheck,
  AlertTriangle,
  Bookmark,
  Layers,
  Network,
  ExternalLink
} from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { formatDetailedError } from '@/utils/formatError'
import {
  insertAuditLog,
  upsertStaffProfile,
  fetchSchools,
  fetchStaffProfiles,
  fetchPortalTasks,
  createPortalTask,
  updatePortalTask,
  archivePortalTask,
  toggleTaskCompletionInSupabase,
  fetchTaskCompletionsForTask,
  fetchPortalAnnouncements,
  createPortalAnnouncement,
  updatePortalAnnouncement,
  archivePortalAnnouncement,
  fetchPortalEvents,
  createPortalEvent,
  updatePortalEvent,
  archivePortalEvent
} from '@/lib/supabase/queries'
import { REGISTERED_SYSTEMS, SystemConfig } from '@/config/systems'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { captureGenieOrigin, useGenieModal } from '@/utils/genieAnimation'
import type {
  AdminProfile,
  School,
  PortalTask,
  PortalAnnouncement,
  PortalEvent,
  TaskScopeType
} from '@/types'

const STORAGE_KEYS = {
  TASKS: 'schoolconnect_portal_tasks',
  ANNOUNCEMENTS: 'schoolconnect_portal_announcements',
  EVENTS: 'schoolconnect_portal_events'
}

const formatDateForInput = (dateStr?: string) => {
  if (!dateStr) {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  }
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`
  }
  const d = new Date(dateStr)
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

const formatDateForDisplay = (dateStr?: string) => {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('-')
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return dateStr
}

export function SchoolConnectHubPage() {
  const { admin, signOut, updateAdminProfile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // Account Settings Dropdown & Modal State
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  const { shouldRender: shouldRenderSettingsModal } = useGenieModal(isSettingsModalOpen, () => setIsSettingsModalOpen(false))

  const [settingsName, setSettingsName] = useState('')
  const [settingsEmail, setSettingsEmail] = useState('')
  const [settingsPassword, setSettingsPassword] = useState('')
  const [settingsShowPassword, setSettingsShowPassword] = useState(false)
  const [settingsAvatarUrl, setSettingsAvatarUrl] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)

  // --- SUPABASE DIRECTORY DATA FOR SCOPE TARGETING ---
  const [schools, setSchools] = useState<School[]>([])
  const [staffList, setStaffList] = useState<AdminProfile[]>([])

  // --- TASKS, ANNOUNCEMENTS, AND EVENTS STATES ---
  const [tasks, setTasks] = useState<PortalTask[]>([])
  const [announcements, setAnnouncements] = useState<PortalAnnouncement[]>([])
  const [events, setEvents] = useState<PortalEvent[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Initial Data Fetch from Supabase
  const loadPortalData = async () => {
    setLoadingData(true)
    try {
      const [fetchedTasks, fetchedAnn, fetchedEvts, fetchedSchools, fetchedStaff] = await Promise.all([
        fetchPortalTasks(admin),
        fetchPortalAnnouncements(),
        fetchPortalEvents(),
        fetchSchools().catch(() => []),
        fetchStaffProfiles().catch(() => [])
      ])

      setTasks(fetchedTasks)
      setAnnouncements(fetchedAnn)
      setEvents(fetchedEvts)
      setSchools(fetchedSchools)
      setStaffList(fetchedStaff)
    } catch (err) {
      console.warn('Error loading Supabase portal data:', err)
      setTasks([])
      setAnnouncements([])
      setEvents([])
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    loadPortalData()
  }, [admin?.id])

  // Backup sync to LocalStorage
  useEffect(() => {
    if (tasks.length > 0) localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    if (announcements.length > 0) localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements))
  }, [announcements])

  useEffect(() => {
    if (events.length > 0) localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events))
  }, [events])

  // --- TASK FILTER & SCOPE MODAL STATES ---
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed' | 'archived'>('all')
  const [annTab, setAnnTab] = useState<'active' | 'archived'>('active')
  const [eventTab, setEventTab] = useState<'active' | 'archived'>('active')
  const [notifTab, setNotifTab] = useState<'all' | 'tasks' | 'announcements' | 'events'>('all')
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<PortalTask | null>(null)

  // --- TASK COMPLIANCE MONITOR STATES ---
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false)
  const [complianceTask, setComplianceTask] = useState<PortalTask | null>(null)
  const [complianceRecords, setComplianceRecords] = useState<{ id: string; taskId: string; userId: string; completedAt: string }[]>([])
  const [isLoadingCompliance, setIsLoadingCompliance] = useState(false)
  const [complianceFilterTab, setComplianceFilterTab] = useState<'all' | 'completed' | 'pending'>('all')

  // --- TASK COMPLETION CONFIRMATION DIALOG STATE ---
  const [completeConfirmDialog, setCompleteConfirmDialog] = useState<{
    isOpen: boolean
    taskId: string
    taskTitle: string
    willComplete: boolean
  }>({
    isOpen: false,
    taskId: '',
    taskTitle: '',
    willComplete: true
  })
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    hasNoDueDate: false,
    reminderDaysBefore: 3,
    priority: 'normal' as 'high' | 'medium' | 'normal',
    category: 'Evaluation',
    scopeType: 'district' as TaskScopeType,
    targetSchoolId: '',
    targetRole: 'ao_2',
    targetUserId: ''
  })

  // --- ANNOUNCEMENT MODAL STATES ---
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false)
  const [editingAnn, setEditingAnn] = useState<PortalAnnouncement | null>(null)
  const [annForm, setAnnForm] = useState({
    title: '',
    content: '',
    tag: 'Important',
    author: admin?.full_name || 'District Office',
    isPinned: false
  })

  // --- EVENT MODAL STATES ---
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<PortalEvent | null>(null)
  const [viewingEvent, setViewingEvent] = useState<PortalEvent | null>(null)
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    time: '',
    venue: '',
    category: 'Meeting',
    description: ''
  })

  // --- RICH FORMATTED DESCRIPTION PARSER ---
  const parseInlineMarkdown = (text: string) => {
    if (!text) return text
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|__.*?__| _.*?_)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-black text-[#2D2638]">{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('__') && part.endsWith('__')) {
        return <strong key={i} className="font-black text-[#2D2638]">{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="italic text-blue-900 font-semibold">{part.slice(1, -1)}</em>
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return <em key={i} className="italic text-blue-900 font-semibold">{part.slice(1, -1)}</em>
      }
      return part
    })
  }

  const renderFormattedEventDescription = (description?: string) => {
    if (!description || !description.trim()) {
      return <p className="text-xs text-[#7A7289] italic">No description details provided for this event.</p>
    }

    let raw = description.trim()
    if (!raw.includes('\n')) {
      raw = raw
        .replace(/\s*(Where\s*:|Theme\s*:|Venue\s*:|Food\s*:?|Note\s*:|Schedule\s*:)/gi, '\n$1')
        .replace(/\s*\*\s*/g, '\n* ')
        .replace(/\s+([A-Za-z]{2,5}\s*-)/g, '\n$1')
        .trim()
    }

    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0)

    return (
      <div className="space-y-2.5 text-xs leading-relaxed text-[#2D2638]">
        {lines.map((line, idx) => {
          const kvMatch = line.match(/^(Where|Theme|Venue|Location|Date|Organizers?|Note|Food|Details)\s*:\s*(.*)$/i)
          if (kvMatch) {
            const key = kvMatch[1].toUpperCase()
            const val = kvMatch[2]
            return (
              <div key={idx} className="p-3 rounded-xl bg-blue-50/80 border border-blue-100 flex flex-wrap items-center gap-2 shadow-2xs">
                <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-black text-[10px] uppercase tracking-wider">
                  {key}
                </span>
                <span className="font-bold text-[#2D2638] text-xs">{parseInlineMarkdown(val)}</span>
              </div>
            )
          }

          const schoolMatch = line.match(/^([A-Za-z]{2,5})\s*-\s*(.*)$/)
          if (schoolMatch) {
            const code = schoolMatch[1].toUpperCase()
            const item = schoolMatch[2]
            return (
              <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-purple-50/70 border border-purple-100">
                <span className="px-2 py-0.5 rounded-md bg-[#8B72F4] text-white font-black text-[10px] shrink-0">
                  {code}
                </span>
                <span className="font-semibold text-[#2D2638] text-xs">{parseInlineMarkdown(item)}</span>
              </div>
            )
          }

          if (line.startsWith('*') || line.startsWith('-') || line.startsWith('•')) {
            const cleanText = line.replace(/^[\*\-•]\s*/, '')
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-2 py-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <span className="font-semibold text-[#2D2638]">{parseInlineMarkdown(cleanText)}</span>
              </div>
            )
          }

          if (line.endsWith(':')) {
            return (
              <h5 key={idx} className="font-black text-xs text-[#2D2638] uppercase tracking-wider pt-2 border-b border-purple-100 pb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-blue-500 rounded-full" />
                {line}
              </h5>
            )
          }

          return (
            <p key={idx} className="font-medium text-[#4A405A] leading-relaxed">
              {parseInlineMarkdown(line)}
            </p>
          )
        })}
      </div>
    )
  }


  // --- ARCHIVE CONFIRMATION DIALOG STATE ---
  const [archiveDialog, setArchiveDialog] = useState<{
    isOpen: boolean
    type: 'task' | 'announcement' | 'event'
    id: string
    title: string
  }>({
    isOpen: false,
    type: 'task',
    id: '',
    title: ''
  })

  // Account Settings Handlers
  const handleOpenSettings = (e?: React.MouseEvent) => {
    if (e) captureGenieOrigin(e)
    if (admin) {
      setSettingsName(admin.full_name || '')
      setSettingsEmail(admin.email || '')
      setSettingsPassword(admin.password || '')
      setSettingsAvatarUrl(admin.avatar_url || '')
    }
    setIsSettingsModalOpen(true)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast('Photo must be under 2MB', 'error')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setSettingsAvatarUrl(reader.result as string)
        toast('Photo selected!', 'info')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveAccountSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!admin) return
    setSavingAccount(true)
    try {
      const updatedFields: Partial<AdminProfile> = {
        id: admin.id,
        full_name: settingsName.trim(),
        email: settingsEmail.trim(),
        role: admin.role,
        is_active: admin.is_active,
        avatar_url: settingsAvatarUrl,
        assigned_school_ids: admin.assigned_school_ids,
        assigned_grade_ids: admin.assigned_grade_ids,
        teacher_category: admin.teacher_category,
        district_name: admin.district_name,
        updated_at: new Date().toISOString()
      }

      if (settingsPassword.trim()) {
        updatedFields.password = settingsPassword.trim()
      }

      await upsertStaffProfile(updatedFields)
      updateAdminProfile(updatedFields)

      await insertAuditLog({
        admin_id: admin.id,
        admin_name: settingsName.trim(),
        action: 'update_account_settings',
        details: { updated_fields: ['full_name', 'email', 'avatar_url', ...(settingsPassword ? ['password'] : [])] }
      })

      toast('Account settings updated successfully!', 'success')
      setIsSettingsModalOpen(false)
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to update account settings in Supabase', table: 'sc_admin_profiles' }), 'error')
    } finally {
      setSavingAccount(false)
    }
  }

  // Permission Check Helper: Only creator or admin with full access can edit/delete
  const canManageItem = (itemCreatorId?: string) => {
    if (!admin) return false
    if (admin.role === 'admin' || admin.role === 'superadmin' || admin.role === 'psds' || (admin.role === 'ao_2' && !!admin.district_name)) return true
    return Boolean(itemCreatorId && itemCreatorId === admin.id)
  }

  const isAdminUser = admin?.role === 'admin' || admin?.role === 'superadmin' || admin?.role === 'psds' || (admin?.role === 'ao_2' && !!admin?.district_name)

  const handleRestrictedAdminClick = (e: React.MouseEvent) => {
    e.preventDefault()
    toast('Access Restricted: System Administrator privileges required to access Platform Administration & Staff.', 'warning')
  }

  // --- TASK ACTIONS WITH SUPABASE ---
  const handleRequestToggleComplete = (task: PortalTask) => {
    if (task.isArchived) return
    setCompleteConfirmDialog({
      isOpen: true,
      taskId: task.id,
      taskTitle: task.title,
      willComplete: !task.completed
    })
  }

  const confirmToggleTaskComplete = async () => {
    const { taskId, willComplete } = completeConfirmDialog
    setCompleteConfirmDialog({ isOpen: false, taskId: '', taskTitle: '', willComplete: true })

    const targetTask = tasks.find(t => t.id === taskId)
    if (!targetTask) return

    // Optimistic UI Update
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, completed: willComplete } : t))
    )

    if (admin?.id) {
      try {
        await toggleTaskCompletionInSupabase(taskId, admin.id, willComplete)
        toast(willComplete ? 'Task marked as completed!' : 'Task reopened as pending', 'info')
      } catch (err) {
        toast(formatDetailedError(err, { action: 'Failed to update task completion status in Supabase', table: 'sc_portal_task_completions' }), 'error')
      }
    }
  }

  const handleOpenComplianceModal = async (task: PortalTask) => {
    setComplianceTask(task)
    setIsLoadingCompliance(true)
    setComplianceFilterTab('all')
    setIsComplianceModalOpen(true)
    try {
      const records = await fetchTaskCompletionsForTask(task.id)
      setComplianceRecords(records)
    } catch (err) {
      console.error('Failed to load compliance records:', err)
      toast('Failed to load task compliance data', 'error')
    } finally {
      setIsLoadingCompliance(false)
    }
  }

  const handleOpenTaskModal = (taskToEdit?: PortalTask) => {
    if (taskToEdit) {
      if (!canManageItem(taskToEdit.createdBy)) {
        toast('Permission denied: You can only edit tasks you created.', 'error')
        return
      }
      setEditingTask(taskToEdit)
      setTaskForm({
        title: taskToEdit.title,
        description: taskToEdit.description || '',
        dueDate: formatDateForInput(taskToEdit.dueDate),
        hasNoDueDate: !taskToEdit.dueDate,
        reminderDaysBefore: taskToEdit.reminderDaysBefore ?? 3,
        priority: taskToEdit.priority,
        category: taskToEdit.category,
        scopeType: taskToEdit.scopeType || 'district',
        targetSchoolId: taskToEdit.targetSchoolId || '',
        targetRole: taskToEdit.targetRole || 'ao_2',
        targetUserId: taskToEdit.targetUserId || ''
      })
    } else {
      setEditingTask(null)
      setTaskForm({
        title: '',
        description: '',
        dueDate: new Date().toISOString().split('T')[0],
        hasNoDueDate: false,
        reminderDaysBefore: 3,
        priority: 'normal',
        category: 'Evaluation',
        scopeType: 'district',
        targetSchoolId: schools[0]?.id || '',
        targetRole: 'ao_2',
        targetUserId: staffList[0]?.id || ''
      })
    }
    setIsTaskModalOpen(true)
  }

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskForm.title.trim()) return

    const finalDueDate = taskForm.hasNoDueDate ? '' : taskForm.dueDate

    try {
      if (editingTask) {
        if (!canManageItem(editingTask.createdBy)) {
          toast('Permission denied: You can only edit tasks you created.', 'error')
          return
        }
        const updatedFields = {
          title: taskForm.title.trim(),
          description: taskForm.description.trim(),
          dueDate: finalDueDate,
          reminderDaysBefore: taskForm.reminderDaysBefore,
          priority: taskForm.priority,
          category: taskForm.category,
          scopeType: taskForm.scopeType,
          targetSchoolId: taskForm.scopeType === 'school' ? taskForm.targetSchoolId : undefined,
          targetRole: taskForm.scopeType === 'role' ? (taskForm.targetRole as any) : undefined,
          targetUserId: taskForm.scopeType === 'user' ? taskForm.targetUserId : undefined
        }
        setTasks(prev => prev.map(t => (t.id === editingTask.id ? { ...t, ...updatedFields } : t)))
        await updatePortalTask(editingTask.id, updatedFields)
        toast('Task updated successfully!', 'success')
      } else {
        // Create in Supabase
        await createPortalTask({
          title: taskForm.title,
          description: taskForm.description,
          dueDate: finalDueDate,
          reminderDaysBefore: taskForm.reminderDaysBefore,
          priority: taskForm.priority,
          category: taskForm.category,
          scopeType: taskForm.scopeType,
          targetSchoolId: taskForm.scopeType === 'school' ? taskForm.targetSchoolId : undefined,
          targetRole: taskForm.scopeType === 'role' ? taskForm.targetRole : undefined,
          targetUserId: taskForm.scopeType === 'user' ? taskForm.targetUserId : undefined,
          createdBy: admin?.id
        })
        toast('New scoped task published to Supabase!', 'success')
      }
      loadPortalData()
      setIsTaskModalOpen(false)
      setEditingTask(null)
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to save task to Supabase', table: 'sc_portal_tasks' }), 'error')
    }
  }

  // --- ANNOUNCEMENT ACTIONS WITH SUPABASE ---
  const handleOpenAnnModal = (annToEdit?: PortalAnnouncement) => {
    if (annToEdit) {
      if (!canManageItem(annToEdit.authorId)) {
        toast('Permission denied: You can only edit announcements you authored.', 'error')
        return
      }
      setEditingAnn(annToEdit)
      setAnnForm({
        title: annToEdit.title,
        content: annToEdit.content,
        tag: annToEdit.tag,
        author: annToEdit.author,
        isPinned: !!annToEdit.isPinned
      })
    } else {
      setEditingAnn(null)
      setAnnForm({
        title: '',
        content: '',
        tag: 'Important',
        author: admin?.full_name || 'District Office',
        isPinned: false
      })
    }
    setIsAnnModalOpen(true)
  }

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!annForm.title.trim() || !annForm.content.trim()) return

    try {
      if (editingAnn) {
        if (!canManageItem(editingAnn.authorId)) {
          toast('Permission denied: You can only edit announcements you authored.', 'error')
          return
        }
        const updatedFields = {
          title: annForm.title.trim(),
          content: annForm.content.trim(),
          tag: annForm.tag,
          authorName: annForm.author.trim(),
          isPinned: annForm.isPinned
        }
        setAnnouncements(prev => prev.map(a => (a.id === editingAnn.id ? {
          ...a,
          title: updatedFields.title,
          content: updatedFields.content,
          tag: updatedFields.tag,
          author: updatedFields.authorName,
          isPinned: updatedFields.isPinned
        } : a)))
        await updatePortalAnnouncement(editingAnn.id, updatedFields)
        toast('Announcement updated successfully!', 'success')
      } else {
        await createPortalAnnouncement({
          title: annForm.title,
          content: annForm.content,
          tag: annForm.tag,
          authorName: annForm.author,
          authorId: admin?.id,
          isPinned: annForm.isPinned
        })
        toast('Announcement published to Supabase!', 'success')
      }
      loadPortalData()
      setIsAnnModalOpen(false)
      setEditingAnn(null)
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to save announcement to Supabase', table: 'sc_portal_announcements' }), 'error')
    }
  }

  const togglePinAnnouncement = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const targetAnn = announcements.find(a => a.id === id)
    if (!targetAnn) return

    if (!canManageItem(targetAnn.authorId)) {
      toast('Permission denied: Only the author or an admin can pin announcements.', 'error')
      return
    }

    const newPinned = !targetAnn.isPinned
    setAnnouncements(prev =>
      prev.map(a => (a.id === id ? { ...a, isPinned: newPinned } : a))
    )

    try {
      await updatePortalAnnouncement(id, { isPinned: newPinned })
      toast('Announcement pin status updated', 'info')
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to update announcement pin state', table: 'sc_portal_announcements' }), 'error')
    }
  }

  // --- EVENT ACTIONS WITH SUPABASE ---
  const handleOpenEventModal = (evtToEdit?: PortalEvent) => {
    if (evtToEdit) {
      if (!canManageItem(evtToEdit.createdBy)) {
        toast('Permission denied: You can only edit events you scheduled.', 'error')
        return
      }
      setEditingEvent(evtToEdit)
      setEventForm({
        title: evtToEdit.title,
        date: formatDateForInput(evtToEdit.date),
        time: evtToEdit.time,
        venue: evtToEdit.venue,
        category: evtToEdit.category,
        description: evtToEdit.description || ''
      })
    } else {
      setEditingEvent(null)
      setEventForm({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00 AM - 11:00 AM',
        venue: 'District Conference Room',
        category: 'Meeting',
        description: ''
      })
    }
    setIsEventModalOpen(true)
  }

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventForm.title.trim() || !eventForm.date.trim()) return

    try {
      if (editingEvent) {
        if (!canManageItem(editingEvent.createdBy)) {
          toast('Permission denied: You can only edit events you scheduled.', 'error')
          return
        }
        const updatedFields = {
          title: eventForm.title.trim(),
          date: eventForm.date,
          time: eventForm.time.trim(),
          venue: eventForm.venue.trim(),
          category: eventForm.category,
          description: eventForm.description.trim()
        }
        setEvents(prev => prev.map(e => (e.id === editingEvent.id ? { ...e, ...updatedFields } : e)))
        await updatePortalEvent(editingEvent.id, updatedFields)
        toast('Event updated successfully!', 'success')
      } else {
        await createPortalEvent({
          title: eventForm.title,
          date: eventForm.date,
          time: eventForm.time,
          venue: eventForm.venue,
          category: eventForm.category,
          description: eventForm.description,
          createdBy: admin?.id
        })
        toast('New event scheduled in Supabase!', 'success')
      }
      loadPortalData()
      setIsEventModalOpen(false)
      setEditingEvent(null)
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to save event to Supabase', table: 'sc_portal_events' }), 'error')
    }
  }

  // --- ARCHIVE ITEM HANDLER WITH SUPABASE ---
  const confirmArchiveItem = async () => {
    const { type, id } = archiveDialog
    try {
      if (type === 'task') {
        const target = tasks.find(t => t.id === id)
        if (target && !canManageItem(target.createdBy)) {
          toast('Permission denied: Only the creator or an admin can archive this task.', 'error')
          setArchiveDialog({ isOpen: false, type: 'task', id: '', title: '' })
          return
        }
        await archivePortalTask(id, true)
        setTasks(prev => prev.map(t => (t.id === id ? { ...t, isArchived: true } : t)))
        toast('Task archived successfully', 'info')
      } else if (type === 'announcement') {
        const target = announcements.find(a => a.id === id)
        if (target && !canManageItem(target.authorId)) {
          toast('Permission denied: Only the author or an admin can archive this announcement.', 'error')
          setArchiveDialog({ isOpen: false, type: 'announcement', id: '', title: '' })
          return
        }
        await archivePortalAnnouncement(id, true)
        setAnnouncements(prev => prev.map(a => (a.id === id ? { ...a, isArchived: true } : a)))
        toast('Announcement archived successfully', 'info')
      } else if (type === 'event') {
        const target = events.find(e => e.id === id)
        if (target && !canManageItem(target.createdBy)) {
          toast('Permission denied: Only the organizer or an admin can archive this event.', 'error')
          setArchiveDialog({ isOpen: false, type: 'event', id: '', title: '' })
          return
        }
        await archivePortalEvent(id, true)
        setEvents(prev => prev.map(e => (e.id === id ? { ...e, isArchived: true } : e)))
        toast('Event archived successfully', 'info')
      }
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to archive item in Supabase' }), 'error')
    }
    setArchiveDialog({ isOpen: false, type: 'task', id: '', title: '' })
  }

  const handleUnarchiveItem = async (type: 'task' | 'announcement' | 'event', id: string) => {
    try {
      if (type === 'task') {
        const target = tasks.find(t => t.id === id)
        if (target && !canManageItem(target.createdBy)) {
          toast('Permission denied: Only the creator or an admin can restore this task.', 'error')
          return
        }
        await archivePortalTask(id, false)
        setTasks(prev => prev.map(t => (t.id === id ? { ...t, isArchived: false } : t)))
        toast('Task restored from archive', 'success')
      } else if (type === 'announcement') {
        const target = announcements.find(a => a.id === id)
        if (target && !canManageItem(target.authorId)) {
          toast('Permission denied: Only the author or an admin can restore this announcement.', 'error')
          return
        }
        await archivePortalAnnouncement(id, false)
        setAnnouncements(prev => prev.map(a => (a.id === id ? { ...a, isArchived: false } : a)))
        toast('Announcement restored from archive', 'success')
      } else if (type === 'event') {
        const target = events.find(e => e.id === id)
        if (target && !canManageItem(target.createdBy)) {
          toast('Permission denied: Only the organizer or an admin can restore this event.', 'error')
          return
        }
        await archivePortalEvent(id, false)
        setEvents(prev => prev.map(e => (e.id === id ? { ...e, isArchived: false } : e)))
        toast('Event restored from archive', 'success')
      }
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to restore item in Supabase' }), 'error')
    }
  }

  // Calculate days remaining helper
  const getDaysRemaining = (dueDateStr?: string) => {
    if (!dueDateStr) return 9999
    const ymdMatch = dueDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
    let taskDate: Date
    if (ymdMatch) {
      taskDate = new Date(parseInt(ymdMatch[1], 10), parseInt(ymdMatch[2], 10) - 1, parseInt(ymdMatch[3], 10))
    } else {
      taskDate = new Date(dueDateStr)
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    taskDate.setHours(0, 0, 0, 0)
    const diffTime = taskDate.getTime() - today.getTime()
    return Math.round(diffTime / (1000 * 60 * 60 * 24))
  }

  const priorityWeight: Record<string, number> = { high: 3, medium: 2, normal: 1 }

  // Filtered & Prioritized Tasks by Due Date
  const filteredTasks = tasks
    .filter(t => {
      if (taskFilter === 'archived') return t.isArchived
      if (t.isArchived) return false
      if (taskFilter === 'pending') return !t.completed
      if (taskFilter === 'completed') return t.completed
      return true
    })
    .sort((a, b) => {
      // 1. Pending tasks before completed tasks
      if (a.completed !== b.completed) return a.completed ? 1 : -1

      // 2. Prioritize by due date (overdue & urgent earliest due dates first)
      const daysA = getDaysRemaining(a.dueDate)
      const daysB = getDaysRemaining(b.dueDate)
      if (daysA !== daysB) return daysA - daysB

      // 3. Priority weight (high > medium > normal)
      const weightA = priorityWeight[a.priority] || 1
      const weightB = priorityWeight[b.priority] || 1
      return weightB - weightA
    })

  // Active Reminder Tasks (pending tasks currently inside their reminder notification window)
  const activeTaskReminders = tasks.filter(t => {
    if (t.completed || t.isArchived || !t.dueDate) return false
    const days = getDaysRemaining(t.dueDate)
    const threshold = t.reminderDaysBefore ?? 3
    return days <= threshold
  })

  const todayYmd = new Date().toISOString().split('T')[0]

  const isEventPast = (dateStr?: string) => {
    if (!dateStr) return false
    const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (ymdMatch) {
      return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}` < todayYmd
    }
    return dateStr < todayYmd
  }

  // Active Notification Aggregation
  const activeTasksNotif = tasks.filter(t => !t.completed && !t.isArchived)
  const activeAnnouncementsNotif = announcements.filter(a => !a.isArchived)
  const activeEventsNotif = events.filter(e => !e.isArchived && !isEventPast(e.date))
  const totalNotifCount = activeTasksNotif.length + activeAnnouncementsNotif.length + activeEventsNotif.length

  // Filtered & Sorted Announcements (Pinned first)
  const displayedAnnouncements = announcements
    .filter(a => (annTab === 'archived' ? a.isArchived : !a.isArchived))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })

  // Filtered Events (Past events automatically classified as archived)
  const displayedEvents = events.filter(e => {
    const autoArchived = e.isArchived || isEventPast(e.date)
    return eventTab === 'archived' ? autoArchived : !autoArchived
  })

  const filteredSystems = REGISTERED_SYSTEMS.filter(
    (sys) =>
      sys.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sys.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sys.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    document.title = 'School Connect - Portal Hub'
  }, [])

  const handleLaunchSystem = (sys: SystemConfig) => {
    if (sys.enabled) {
      navigate(sys.route)
    }
  }

  const handleSignOut = async () => {
    try {
      if (admin) {
        await insertAuditLog({
          admin_id: admin.id,
          admin_name: admin.full_name,
          action: 'logout',
          details: { system: 'School Connect Portal Hub' },
        })
      }
      await signOut()
      toast('Signed out successfully.', 'info')
      navigate('/')
    } catch {
      toast('Failed to sign out', 'error')
    } finally {
      setShowLogoutConfirm(false)
    }
  }

  return (
    <div className="min-h-screen relative bg-[#F4F6F9] text-slate-800 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Responsive Fixed Non-Scrollable Background Wallpaper */}
      <picture className="fixed inset-0 w-screen h-[100dvh] min-h-[100dvh] overflow-hidden pointer-events-none z-0">
        <source media="(max-width: 768px)" srcSet="/images/bg-mobile.png" />
        <img
          src="/images/bg-desktop.png"
          alt="Background Wallpaper"
          className="w-screen h-[100dvh] min-h-[100dvh] object-cover object-center opacity-40 mix-blend-multiply transition-opacity duration-700 pointer-events-none"
        />
      </picture>

      {/* Minimal Canvas Background Overlay */}
      <div className="fixed inset-0 w-screen h-[100dvh] bg-[#F4F6F9]/80 pointer-events-none z-0" />

      {/* Top Header Navbar - Fixed at Top Screen Edge */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 shadow-2xs">
        {/* Official Logo Display & User Greeting */}
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/portal" className="flex items-center gap-2 group shrink-0">
            <img
              src="/images/school_connect_logo.png"
              alt="School Connect Official Logo"
              className="h-9 sm:h-10 w-auto object-contain"
            />
            <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight hidden xs:inline-block">
              School<span className="text-[#2563EB]">Connect</span>
            </span>
          </Link>
          
          <div className="hidden sm:block min-w-0 border-l border-slate-200 pl-3">
            <h1 className="text-xs sm:text-sm font-semibold text-slate-800 tracking-tight truncate">
              Good day, {admin?.full_name?.split(' ')[0] || 'Administrator'}! 👋
            </h1>
            <p className="text-[11px] text-slate-500 font-normal truncate">
              Welcome to School Connect Unified Portal
            </p>
          </div>
        </div>

        {/* User Profile / Auth Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* INTERACTIVE NOTIFICATION BELL */}
          <div className="relative">
            <button
              onClick={() => setIsNotifMenuOpen(prev => !prev)}
              className="relative p-2 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-[#2563EB] hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center"
              title="View Unified Portal Notifications"
            >
              <Bell size={16} />
              {totalNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border border-white">
                  {totalNotifCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Menu */}
            {isNotifMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsNotifMenuOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-80 sm:w-88 bg-white rounded-lg border border-slate-200 shadow-lg z-50 p-3 space-y-2 animate-fade-in font-sans">
                  
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-[#2563EB] text-white">
                        <Bell size={13} />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">Notifications & Alerts</h4>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100">
                      {totalNotifCount} Active
                    </span>
                  </div>

                  {/* Filter Category Tabs */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-[10px] font-medium">
                    <button
                      onClick={() => setNotifTab('all')}
                      className={`flex-1 py-1 rounded transition-all cursor-pointer ${
                        notifTab === 'all' ? 'bg-white text-[#2563EB] font-semibold shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      All ({totalNotifCount})
                    </button>
                    <button
                      onClick={() => setNotifTab('tasks')}
                      className={`flex-1 py-1 rounded transition-all cursor-pointer ${
                        notifTab === 'tasks' ? 'bg-white text-[#2563EB] font-semibold shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Tasks ({activeTasksNotif.length})
                    </button>
                    <button
                      onClick={() => setNotifTab('announcements')}
                      className={`flex-1 py-1 rounded transition-all cursor-pointer ${
                        notifTab === 'announcements' ? 'bg-white text-[#2563EB] font-semibold shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      News ({activeAnnouncementsNotif.length})
                    </button>
                    <button
                      onClick={() => setNotifTab('events')}
                      className={`flex-1 py-1 rounded transition-all cursor-pointer ${
                        notifTab === 'events' ? 'bg-white text-[#2563EB] font-semibold shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Events ({activeEventsNotif.length})
                    </button>
                  </div>

                  {/* Notifications Scroll List */}
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                    {totalNotifCount === 0 ? (
                      <div className="text-center py-5">
                        <Bell size={20} className="mx-auto text-slate-300 mb-1" />
                        <p className="text-xs font-semibold text-slate-700">All caught up!</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">No active notifications at this time.</p>
                      </div>
                    ) : (
                      <>
                        {/* TASKS NOTIFICATIONS */}
                        {(notifTab === 'all' || notifTab === 'tasks') &&
                          activeTasksNotif.map(t => {
                            const days = getDaysRemaining(t.dueDate)
                            const isOver = days < 0
                            const isSoon = days >= 0 && days <= (t.reminderDaysBefore ?? 3)
                            return (
                              <div
                                key={`notif-task-${t.id}`}
                                onClick={() => {
                                  setIsNotifMenuOpen(false)
                                  document.getElementById('tasks-management-widget')?.scrollIntoView({ behavior: 'smooth' })
                                }}
                                className={`p-2.5 rounded-md border transition-all cursor-pointer flex items-start gap-2 ${
                                  isOver
                                    ? 'bg-rose-50 border-rose-200'
                                    : isSoon
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-blue-50 border-blue-200'
                                }`}
                              >
                                <div className={`p-1 rounded text-white shrink-0 mt-0.5 ${
                                  isOver ? 'bg-rose-500' : isSoon ? 'bg-amber-500' : 'bg-[#2563EB]'
                                }`}>
                                  {isOver ? <AlertTriangle size={12} /> : isSoon ? <Bell size={12} /> : <Target size={12} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <h5 className="text-xs font-bold text-slate-900 truncate">{t.title}</h5>
                                    <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded text-white ${
                                      isOver ? 'bg-rose-600' : isSoon ? 'bg-amber-500' : 'bg-[#2563EB]'
                                    }`}>
                                      {isOver ? 'OVERDUE' : isSoon ? (days === 0 ? 'TODAY' : `${days}d LEFT`) : 'ASSIGNED'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                                    Due: {formatDateForDisplay(t.dueDate)} &bull; {t.scopeType.toUpperCase()} Scope
                                  </p>
                                </div>
                              </div>
                            )
                          })
                        }

                        {/* ANNOUNCEMENT NOTIFICATIONS */}
                        {(notifTab === 'all' || notifTab === 'announcements') &&
                          activeAnnouncementsNotif.map(a => (
                            <div
                              key={`notif-ann-${a.id}`}
                              onClick={() => {
                                setIsNotifMenuOpen(false)
                                document.getElementById('announcements-widget')?.scrollIntoView({ behavior: 'smooth' })
                              }}
                              className="p-2.5 rounded-md bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer flex items-start gap-2"
                            >
                              <div className="p-1 rounded bg-indigo-500 text-white shrink-0 mt-0.5">
                                <Megaphone size={12} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <h5 className="text-xs font-bold text-slate-900 truncate">{a.title}</h5>
                                  <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                                    NEWS
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                                  By {a.author} &bull; {a.tag}
                                </p>
                              </div>
                            </div>
                          ))
                        }

                        {/* EVENT NOTIFICATIONS */}
                        {(notifTab === 'all' || notifTab === 'events') &&
                          activeEventsNotif.map(e => (
                            <div
                              key={`notif-evt-${e.id}`}
                              onClick={() => {
                                setIsNotifMenuOpen(false)
                                document.getElementById('events-widget')?.scrollIntoView({ behavior: 'smooth' })
                              }}
                              className="p-2.5 rounded-md bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-all cursor-pointer flex items-start gap-2"
                            >
                              <div className="p-1 rounded bg-[#2563EB] text-white shrink-0 mt-0.5">
                                <CalendarDays size={12} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <h5 className="text-xs font-bold text-slate-900 truncate">{e.title}</h5>
                                  <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-blue-100 text-[#2563EB]">
                                    EVENT
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                                  {formatDateForDisplay(e.date)} &bull; {e.time}
                                </p>
                              </div>
                            </div>
                          ))
                        }
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Profile Pill Avatar & Menu Button */}
          {admin ? (
            <div className="relative">
              <button
                onClick={(e) => {
                  captureGenieOrigin(e)
                  setIsAccountMenuOpen(prev => !prev)
                }}
                className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
                title="Account Settings & User Profile"
              >
                <img
                  src={admin.avatar_url || "/images/clay/avatar_girl.jpg"}
                  alt="User Avatar"
                  className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100"
                />
                <div className="text-left hidden xs:block sm:block min-w-0">
                  <span className="text-xs font-semibold text-slate-900 truncate block leading-tight">
                    {admin.full_name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium truncate block">
                    {admin.role === 'ao_2'
                      ? 'AO II Admin'
                      : admin.role === 'school_head'
                      ? 'School Head'
                      : admin.role === 'psds'
                      ? 'PSDS'
                      : admin.role === 'teacher'
                      ? 'Teacher'
                      : 'System Admin'}
                  </span>
                </div>
                <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Account Quick Dropdown Menu */}
              {isAccountMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAccountMenuOpen(false)} />
                  <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-lg border border-slate-200 shadow-lg z-50 p-2 space-y-1 animate-fade-in font-sans">
                    <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                      <img
                        src={admin.avatar_url || "/images/clay/avatar_girl.jpg"}
                        alt="User Avatar"
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{admin.full_name}</h4>
                        <p className="text-[10px] text-slate-500 truncate">{admin.email}</p>
                        <span className="inline-block px-1.5 py-0.5 mt-0.5 rounded text-[9px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-100">
                          {admin.role.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-0.5 pt-1">
                      <button
                        onClick={(e) => {
                          setIsAccountMenuOpen(false)
                          handleOpenSettings(e)
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-[#2563EB] transition-all cursor-pointer text-left"
                      >
                        <Settings size={14} className="text-slate-400" />
                        <span>Account Settings</span>
                      </button>

                      <button
                        onClick={(e) => {
                          setIsAccountMenuOpen(false)
                          captureGenieOrigin(e)
                          setShowLogoutConfirm(true)
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-rose-600 hover:bg-rose-50 transition-all cursor-pointer text-left"
                      >
                        <LogOut size={14} className="text-rose-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <ShieldCheck size={14} />
              Portal Login
            </Link>
          )}
        </div>
      </header>

      {/* Main Content Shell with Full Screen Responsive Layout */}
      <main className="relative z-10 flex-1 w-full pt-16 px-4 sm:px-6 pb-6 space-y-6 animate-fade-in max-w-none">
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* LEFT COLUMN: Systems Grid, Master Data, Announcements & Events */}
          <div className="flex-1 min-w-0 space-y-6 w-full">

            {/* Systems & Applications Card */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-[#2563EB] flex items-center justify-center shrink-0 shadow-2xs">
                    <Grid className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">School Systems & Applications</h3>
                    <p className="text-xs text-slate-500 font-medium">Core educational applications, evaluation engines & record systems</p>
                  </div>
                </div>

                {/* Inset Search Input Pill */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search systems..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Systems Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSystems.map((sys) => {
                  const Icon = sys.icon
                  const isActive = sys.enabled

                  return (
                    <div
                      key={sys.id}
                      onClick={() => handleLaunchSystem(sys)}
                      className={`p-4 rounded-xl transition-all duration-200 flex items-center justify-between gap-3 group ${
                        isActive
                          ? 'bg-white border border-slate-200/80 shadow-xs hover:border-[#2563EB] hover:shadow-sm cursor-pointer'
                          : 'bg-slate-50 opacity-60 cursor-not-allowed border border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                          isActive
                            ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#2563EB]'
                            : 'bg-slate-100 border-slate-200 text-slate-400'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate group-hover:text-[#2563EB] transition-colors">
                            {sys.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate font-medium mt-0.5">
                            {sys.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap border ${
                          isActive
                            ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {sys.badgeText || (isActive ? 'Active' : 'Soon')}
                        </span>
                        {isActive ? (
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] transition-transform group-hover:translate-x-0.5" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Global Governance & Master Data Section (Above Announcements & Events) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">

              {/* 1. Academic Structure & Master Data */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-[#2563EB] flex items-center justify-center shrink-0 shadow-2xs">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight">Academic Structure & Master Data</h3>
                    <p className="text-xs text-slate-500 font-medium">Schools, learning areas, and academic calendars</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link
                    to="/admin/schools"
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-[#2563EB] hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 text-[#2563EB] flex items-center justify-center shrink-0">
                        <Building2 className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#2563EB] truncate transition-colors">Schools Directory</h4>
                        <p className="text-[10px] text-slate-500 truncate font-medium mt-0.5">School list & type setup</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
                  </Link>

                  <Link
                    to="/admin/learning-areas"
                    className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-white hover:border-emerald-500 hover:shadow-2xs transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 truncate transition-colors">Learning Areas</h4>
                        <p className="text-[10px] text-slate-500 truncate font-normal mt-0.5">Subjects & grade mapping</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
                  </Link>

                  <Link
                    to="/admin/school-years"
                    className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-white hover:border-[#2563EB] hover:shadow-2xs transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 text-[#2563EB] flex items-center justify-center shrink-0">
                        <Calendar className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#2563EB] truncate transition-colors">School Years & Terms</h4>
                        <p className="text-[10px] text-slate-500 truncate font-normal mt-0.5">Academic calendar & quarters</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
                  </Link>

                  <Link
                    to="/admin/sections"
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-amber-500 hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Bookmark className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 truncate transition-colors">School Sections</h4>
                        <p className="text-[10px] text-slate-500 truncate font-medium mt-0.5">Manage sections per school</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
                  </Link>
                </div>
              </div>

              {/* 2. Platform Administration & Security */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-xl ${isAdminUser ? 'bg-blue-50 border border-blue-100 text-[#2563EB]' : 'bg-slate-100 border border-slate-200 text-slate-400'} flex items-center justify-center shrink-0 shadow-2xs`}>
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">Platform Administration & Staff</h3>
                      <p className="text-xs text-slate-500 font-medium truncate">Personnel, superadmins, audit logs & settings</p>
                    </div>
                  </div>
                  {!isAdminUser && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                      <Lock className="w-3 h-3 text-amber-600" />
                      <span>Admin Access Required</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Public View Org Chart Menu Item */}
                  <a
                    href="#/org-chart"
                    onClick={(e) => {
                      e.preventDefault()
                      window.open('/org-chart', '_blank')
                    }}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-[#2563EB] hover:shadow-xs transition-all flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 text-[#2563EB] flex items-center justify-center shrink-0">
                        <Network className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#2563EB] truncate transition-colors">Org Chart</h4>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200">Public</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate font-medium mt-0.5">Faculty & staff ranking chart</p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
                  </a>

                  {isAdminUser ? (
                    <Link
                      to="/portal/staff"
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-pink-500 hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-pink-50 border border-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                          <Users className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-pink-600 truncate transition-colors">Faculty & Staff</h4>
                          <p className="text-[10px] text-slate-500 truncate font-medium mt-0.5">Personnel & assignments</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-pink-600 transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRestrictedAdminClick}
                      className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 opacity-60 cursor-not-allowed flex items-center justify-between gap-3 text-left w-full transition-all group"
                      title="Admin access required"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                          <Users className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-600 truncate">Faculty & Staff</h4>
                          <p className="text-[10px] text-slate-400 truncate font-medium mt-0.5">Personnel & assignments</p>
                        </div>
                      </div>
                      <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </button>
                  )}

                  {isAdminUser ? (
                    <Link
                      to="/admin/administrators"
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-purple-500 hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-purple-600 truncate transition-colors">Administrators</h4>
                          <p className="text-[10px] text-slate-500 truncate font-medium mt-0.5">Superadmin accounts</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRestrictedAdminClick}
                      className="p-3.5 rounded-lg bg-slate-100 border border-slate-200 opacity-60 cursor-not-allowed flex items-center justify-between gap-3 text-left w-full transition-all group"
                      title="Admin access required"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-600 truncate">Administrators</h4>
                          <p className="text-[10px] text-slate-400 truncate font-normal mt-0.5">Superadmin accounts</p>
                        </div>
                      </div>
                      <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </button>
                  )}

                  {isAdminUser ? (
                    <Link
                      to="/admin/audit-logs"
                      className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-white hover:border-emerald-500 hover:shadow-2xs transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                          <ScrollText className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 truncate transition-colors">Audit Logs</h4>
                          <p className="text-[10px] text-slate-500 truncate font-normal mt-0.5">Platform activity log</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRestrictedAdminClick}
                      className="p-3.5 rounded-lg bg-slate-100 border border-slate-200 opacity-60 cursor-not-allowed flex items-center justify-between gap-3 text-left w-full transition-all group"
                      title="Admin access required"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                          <ScrollText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-600 truncate">Audit Logs</h4>
                          <p className="text-[10px] text-slate-400 truncate font-semibold mt-0.5">Platform activity log</p>
                        </div>
                      </div>
                      <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </button>
                  )}

                  {isAdminUser ? (
                    <Link
                      to="/admin/system-settings"
                      className="p-4 rounded-lg bg-white shadow-2xs border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0 border border-blue-100">
                          <Settings className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#2563EB] truncate transition-colors">System Settings</h4>
                          <p className="text-[10px] text-slate-500 truncate font-normal mt-0.5">Configuration & backups</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] transition-transform group-hover:translate-x-1 flex-shrink-0" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRestrictedAdminClick}
                      className="p-4 rounded-lg bg-slate-50 border border-slate-200 opacity-60 cursor-not-allowed flex items-center justify-between gap-3 text-left w-full transition-all group"
                      title="Admin access required"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 border border-slate-300">
                          <Settings className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-600 truncate">System Settings</h4>
                          <p className="text-[10px] text-slate-400 truncate font-normal mt-0.5">Configuration & backups</p>
                        </div>
                      </div>
                      <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* District Announcements & Upcoming Events Section on Main Screen */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* 1. INTERACTIVE ANNOUNCEMENTS WIDGET */}
              <div id="announcements-widget" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs">
                      <Megaphone size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Announcements</h3>
                      <p className="text-[10px] text-slate-500 font-medium">District bulletins & news</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Active vs Archived Tab Switcher */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-[10px] font-semibold">
                      <button
                        onClick={() => setAnnTab('active')}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          annTab === 'active' ? 'bg-white text-[#2563EB] shadow-2xs font-bold' : 'text-slate-600'
                        }`}
                      >
                        Active ({announcements.filter(a => !a.isArchived).length})
                      </button>
                      <button
                        onClick={() => setAnnTab('archived')}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          annTab === 'archived' ? 'bg-white text-[#2563EB] shadow-2xs font-bold' : 'text-slate-600'
                        }`}
                      >
                        Archived ({announcements.filter(a => a.isArchived).length})
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenAnnModal()}
                      className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                      title="Post Announcement"
                    >
                      <Plus size={15} />
                      <span className="hidden xs:inline">Post</span>
                    </button>
                  </div>
                </div>

                {/* Announcement Cards List */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {displayedAnnouncements.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <Megaphone size={24} className="mx-auto text-slate-400 mb-1" />
                      <p className="text-xs font-semibold text-slate-500">
                        {annTab === 'archived' ? 'No archived announcements' : 'No announcements posted'}
                      </p>
                    </div>
                  ) : (
                    displayedAnnouncements.map(ann => {
                      const canManageAnn = canManageItem(ann.authorId)

                      return (
                        <div key={ann.id} className={`p-4 rounded-xl border space-y-2 relative overflow-hidden group transition-all ${
                          ann.isArchived ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-white border-slate-200/80 hover:border-[#2563EB]/40 hover:shadow-xs'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200">
                                {ann.tag}
                              </span>
                              {ann.isPinned && !ann.isArchived && (
                                <span className="text-amber-700 flex items-center gap-1 text-[9px] font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  <Pin size={10} /> Pinned
                                </span>
                              )}
                              {ann.isArchived && (
                                <span className="text-slate-600 flex items-center gap-1 text-[9px] font-semibold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                  <Archive size={10} /> Archived
                                </span>
                              )}
                            </div>

                            {/* Card Controls */}
                            {canManageAnn && (
                              <div className="flex items-center gap-1">
                                {!ann.isArchived && (
                                  <>
                                    <button
                                      onClick={(e) => togglePinAnnouncement(ann.id, e)}
                                      className={`p-1 rounded-lg transition-all cursor-pointer ${
                                        ann.isPinned ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                      }`}
                                      title={ann.isPinned ? 'Unpin' : 'Pin to Top'}
                                    >
                                      <Pin size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleOpenAnnModal(ann)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 transition-all cursor-pointer"
                                      title="Edit Announcement"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      onClick={() => setArchiveDialog({
                                        isOpen: true,
                                        type: 'announcement',
                                        id: ann.id,
                                        title: ann.title
                                      })}
                                      className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer"
                                      title="Archive Announcement"
                                    >
                                      <Archive size={12} />
                                    </button>
                                  </>
                                )}
                                {ann.isArchived && (
                                  <button
                                    onClick={() => handleUnarchiveItem('announcement', ann.id)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                                    title="Restore / Unarchive Announcement"
                                  >
                                    <ArchiveRestore size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 leading-snug">{ann.title}</h4>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-normal">{ann.content}</p>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                            <span>{ann.author}</span>
                            <span>{ann.date}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* 2. INTERACTIVE UPCOMING EVENTS WIDGET */}
              <div id="events-widget" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs">
                      <CalendarDays size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Upcoming Events</h3>
                      <p className="text-[10px] text-slate-500 font-medium">District schedule & activities</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Active vs Archived Tab Switcher */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-[10px] font-semibold">
                      <button
                        onClick={() => setEventTab('active')}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          eventTab === 'active' ? 'bg-white text-[#2563EB] shadow-2xs font-bold' : 'text-slate-600'
                        }`}
                      >
                        Active ({events.filter(e => !e.isArchived).length})
                      </button>
                      <button
                        onClick={() => setEventTab('archived')}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          eventTab === 'archived' ? 'bg-white text-[#2563EB] shadow-2xs font-bold' : 'text-slate-600'
                        }`}
                      >
                        Archived ({events.filter(e => e.isArchived).length})
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenEventModal()}
                      className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                      title="Schedule Event"
                    >
                      <Plus size={15} />
                      <span className="hidden xs:inline">Event</span>
                    </button>
                  </div>
                </div>

                {/* Event Cards List */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {displayedEvents.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <CalendarDays size={24} className="mx-auto text-slate-400 mb-1" />
                      <p className="text-xs font-semibold text-slate-500">
                        {eventTab === 'archived' ? 'No archived events' : 'No upcoming events'}
                      </p>
                    </div>
                  ) : (
                    displayedEvents.map(evt => {
                      const canManageEvt = canManageItem(evt.createdBy)

                      return (
                        <div
                          key={evt.id}
                          onClick={() => setViewingEvent(evt)}
                          className={`p-4 rounded-xl border space-y-2.5 relative group cursor-pointer transition-all ${
                            evt.isArchived ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-white border-slate-200/80 hover:border-[#2563EB]/40 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200">
                              {evt.category}
                            </span>
                            
                            {/* Event Controls */}
                            {canManageEvt && (
                              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                {!evt.isArchived && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenEventModal(evt)
                                      }}
                                      className="p-1 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 transition-all cursor-pointer"
                                      title="Edit Event"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setArchiveDialog({
                                          isOpen: true,
                                          type: 'event',
                                          id: evt.id,
                                          title: evt.title
                                        })
                                      }}
                                      className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer"
                                      title="Archive Event"
                                    >
                                      <Archive size={12} />
                                    </button>
                                  </>
                                )}
                                {evt.isArchived && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleUnarchiveItem('event', evt.id)
                                    }}
                                    className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                                    title="Restore / Unarchive Event"
                                  >
                                    <ArchiveRestore size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold text-slate-900 leading-snug group-hover:text-[#2563EB] transition-colors">
                              {evt.title}
                            </h4>
                            <span className="text-[10px] font-semibold text-[#2563EB] shrink-0 flex items-center gap-0.5">
                              Details &rarr;
                            </span>
                          </div>

                          <div className="pt-2 border-t border-slate-100 space-y-1 text-[10px] text-slate-500 font-medium">
                            <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                              <Calendar size={11} className="text-[#2563EB]" />
                              <span>{formatDateForDisplay(evt.date)}</span>
                              <span>&bull;</span>
                              <Clock size={11} className="text-[#2563EB]" />
                              <span>{evt.time}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <MapPin size={11} className="text-rose-500 shrink-0" />
                              <span className="truncate">{evt.venue}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT SIDEBAR: Scoped Tasks Management */}
          <div className="w-full lg:w-84 xl:w-96 shrink-0 space-y-6 self-start font-sans">

            {/* INTERACTIVE USER TASKS WIDGET */}
            <div id="tasks-management-widget" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <CheckSquare size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight">Tasks Management</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Scoped tasks & compliance</p>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenTaskModal()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                  title="Add New Task with Scope"
                >
                  <Plus size={14} />
                  <span>Task</span>
                </button>
              </div>

              {/* Task Quick Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-semibold text-slate-600">
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                    taskFilter === 'all'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  All ({tasks.filter(t => !t.isArchived).length})
                </button>
                <button
                  onClick={() => setTaskFilter('pending')}
                  className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                    taskFilter === 'pending'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Pending ({tasks.filter(t => !t.completed && !t.isArchived).length})
                </button>
                <button
                  onClick={() => setTaskFilter('completed')}
                  className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                    taskFilter === 'completed'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Done ({tasks.filter(t => t.completed && !t.isArchived).length})
                </button>
                <button
                  onClick={() => setTaskFilter('archived')}
                  className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                    taskFilter === 'archived'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Archive ({tasks.filter(t => t.isArchived).length})
                </button>
              </div>

              {/* Active Daily Reminder Banner */}
              {activeTaskReminders.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-start gap-2.5 shadow-2xs">
                  <div className="p-1 rounded-lg bg-amber-500 text-white shrink-0 mt-0.5">
                    <Bell size={12} />
                  </div>
                  <div className="text-xs min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-bold text-amber-900 text-xs">Task Notification Alert</p>
                      <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[9px] font-bold">
                        {activeTaskReminders.length} Active
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-700 font-medium mt-0.5 leading-relaxed">
                      {activeTaskReminders.some(t => getDaysRemaining(t.dueDate) < 0)
                        ? 'Urgent attention required: You have overdue task(s) needing completion.'
                        : `Daily reminder active for task(s) due within notification window.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Task Items List */}
              <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <CheckSquare size={22} className="mx-auto text-slate-400 mb-1.5" />
                    <p className="text-xs font-semibold text-slate-500">No tasks in this view</p>
                  </div>
                ) : (
                  filteredTasks.map(task => {
                    const schoolName = schools.find(s => s.id === task.targetSchoolId)?.name
                    const targetUserName = staffList.find(s => s.id === task.targetUserId)?.full_name
                    const canManageTask = canManageItem(task.createdBy)
                    const daysRemaining = getDaysRemaining(task.dueDate)
                    const reminderWindow = task.reminderDaysBefore ?? 3
                    const isOverdue = !task.completed && !task.isArchived && !!task.dueDate && daysRemaining < 0
                    const isDueSoon = !task.completed && !task.isArchived && !!task.dueDate && daysRemaining >= 0 && daysRemaining <= reminderWindow

                    return (
                      <div
                        key={task.id}
                        className={`p-3.5 rounded-xl border transition-all group flex items-start gap-3 select-none ${
                          task.isArchived
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : task.completed
                            ? 'bg-slate-50/80 border-slate-200/80 opacity-75'
                            : isOverdue
                            ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                            : isDueSoon
                            ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                            : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={task.isArchived}
                          onClick={() => handleRequestToggleComplete(task)}
                          className={`mt-0.5 shrink-0 rounded-md p-0.5 transition-colors ${
                            task.isArchived ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                          } ${
                            task.completed ? 'text-emerald-600' : 'text-slate-400 hover:text-blue-600'
                          }`}
                          title={task.completed ? 'Mark pending' : 'Mark completed'}
                        >
                          {task.completed ? <CheckSquare size={17} /> : <Square size={17} />}
                        </button>
                        
                        <div className="min-w-0 flex-1 space-y-1">
                          <h4
                            onClick={() => !task.isArchived && handleRequestToggleComplete(task)}
                            className={`text-xs font-bold leading-snug ${task.isArchived ? '' : 'cursor-pointer'} ${
                              task.completed ? 'line-through text-slate-400 font-normal' : 'text-slate-900'
                            }`}
                          >
                            {task.title}
                          </h4>

                          {/* Scope Target Pill Badge */}
                          <div className="flex items-center gap-1.5 flex-wrap text-[9px] font-medium">
                            {task.scopeType === 'district' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 font-semibold">
                                <Globe size={10} /> District Wide
                              </span>
                            )}
                            {task.scopeType === 'school' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold" title="Assigned to all staff of school">
                                <SchoolIcon size={10} /> {schoolName || 'School Wide'}
                              </span>
                            )}
                            {task.scopeType === 'role' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 font-semibold" title="Assigned to position role">
                                <Briefcase size={10} /> {task.targetRole?.replace('_', ' ').toUpperCase()} Scope
                              </span>
                            )}
                            {task.scopeType === 'user' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-100 font-semibold" title="Assigned to specific staff">
                                <UserCheck size={10} /> {targetUserName || 'Specific User'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            {/* Priority Level Badge */}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                              task.priority === 'high'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : task.priority === 'medium'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {task.priority.toUpperCase()}
                            </span>

                            {/* Color-Coded Due Date / Urgency Status Badge */}
                            {!task.dueDate ? (
                              <span className="text-[9px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                                No Due Date
                              </span>
                            ) : isOverdue ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-2xs flex items-center gap-1">
                                <AlertTriangle size={9} /> OVERDUE ({Math.abs(daysRemaining)}d ago)
                              </span>
                            ) : isDueSoon ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-white shadow-2xs flex items-center gap-1">
                                <Bell size={9} /> {daysRemaining === 0 ? 'DUE TODAY' : `DUE IN ${daysRemaining} DAY${daysRemaining === 1 ? '' : 'S'}`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                <Clock size={11} className="text-slate-400" /> {formatDateForDisplay(task.dueDate)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Edit & Archive Action Buttons */}
                        {canManageTask && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!task.isArchived && (
                              <>
                                <button
                                  onClick={() => handleOpenComplianceModal(task)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all cursor-pointer"
                                  title="View Staff Task Compliance Status"
                                >
                                  <Eye size={13} />
                                </button>
                                <button
                                  onClick={() => handleOpenTaskModal(task)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all cursor-pointer"
                                  title="Edit Task"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => setArchiveDialog({
                                    isOpen: true,
                                    type: 'task',
                                    id: task.id,
                                    title: task.title
                                  })}
                                  className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer"
                                  title="Archive Task"
                                >
                                  <Archive size={13} />
                                </button>
                              </>
                            )}
                            {task.isArchived && (
                              <button
                                onClick={() => handleUnarchiveItem('task', task.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                                title="Restore / Unarchive Task"
                              >
                                <ArchiveRestore size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white rounded-2xl border border-slate-200/80 p-5 text-center text-xs text-slate-500 shadow-xs mt-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">School Connect System Platform</span>
            <span>&bull;</span>
            <span className="font-medium">All Educational Modules Integrated</span>
          </div>
          <div className="text-[11px] text-slate-400 font-semibold">
            Department of Education &bull; Integrated Systems
          </div>
        </div>
      </footer>

      {/* --- MODAL DIALOGS --- */}

      {/* 1. SCOPED TASK MODAL */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsTaskModalOpen(false)}>
          <div className="w-full max-w-lg bg-white/95 rounded-[28px] border-2 border-white shadow-[0_24px_60px_rgba(139,114,244,0.22)] p-6 space-y-4 max-h-[90vh] overflow-y-auto font-sans" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#F0E8F5] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#8B72F4] to-[#6C47FF] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#8B72F4]/20">
                  <Target size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#2D2638] tracking-tight font-display">
                    {editingTask ? 'Edit Scoped Task' : 'Create Scoped Task'}
                  </h3>
                  <p className="text-xs font-semibold text-[#7A7289]">Assign tasks to District, Schools, Positions or Staff</p>
                </div>
              </div>
              <button onClick={() => setIsTaskModalOpen(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-[#2D2638] mb-1.5 font-display">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Submit TERMCAT Quarter Reports"
                  value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#FAF5F0]/80 border border-slate-200 rounded-xl text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30 focus:border-[#8B72F4] transition-all"
                />
              </div>

              {/* SCOPE SELECTOR RADIO CARDS */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5 flex items-center gap-1">
                  <Target size={13} className="text-purple-600" /> Assignment Scope & Compliance Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskForm({ ...taskForm, scopeType: 'district' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      taskForm.scopeType === 'district'
                        ? 'bg-purple-50 border-purple-500 text-purple-800 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Globe size={15} /> District Wide
                    </div>
                    <p className="text-[10px] font-normal mt-1 leading-tight text-slate-500">All staff in district must comply</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaskForm({ ...taskForm, scopeType: 'school' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      taskForm.scopeType === 'school'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <SchoolIcon size={15} /> Target School
                    </div>
                    <p className="text-[10px] font-normal mt-1 leading-tight text-slate-500">All staff of school comply</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaskForm({ ...taskForm, scopeType: 'role' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      taskForm.scopeType === 'role'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Briefcase size={15} /> Target Position
                    </div>
                    <p className="text-[10px] font-normal mt-1 leading-tight text-slate-500">All personnel in role comply</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaskForm({ ...taskForm, scopeType: 'user' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      taskForm.scopeType === 'user'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <UserCheck size={15} /> Specific Staff
                    </div>
                    <p className="text-[10px] font-normal mt-1 leading-tight text-slate-500">Target single person</p>
                  </button>
                </div>
              </div>

              {/* DYNAMIC SCOPE SELECTION DROPDOWNS */}
              {taskForm.scopeType === 'school' && (
                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 animate-fade-in">
                  <label className="block text-xs font-bold text-emerald-900 mb-1">Select Target School</label>
                  <select
                    value={taskForm.targetSchoolId}
                    onChange={e => setTaskForm({ ...taskForm, targetSchoolId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-emerald-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.school_type.toUpperCase()})</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-emerald-700 font-medium mt-1.5">
                    💡 All staff assigned to this school will be required to complete this task.
                  </p>
                </div>
              )}

              {taskForm.scopeType === 'role' && (
                <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 animate-fade-in">
                  <label className="block text-xs font-bold text-blue-900 mb-1">Select Target Position / Role</label>
                  <select
                    value={taskForm.targetRole}
                    onChange={e => setTaskForm({ ...taskForm, targetRole: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-blue-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="ao_2">Administrative Officer II (AO II)</option>
                    <option value="school_head">School Heads</option>
                    <option value="teacher">Teachers</option>
                    <option value="psds">PSDS District Supervisors</option>
                    <option value="admin">System Admin</option>
                  </select>
                  <p className="text-[10px] text-blue-700 font-medium mt-1.5">
                    💡 All personnel holding this position across schools will be required to comply.
                  </p>
                </div>
              )}

              {taskForm.scopeType === 'user' && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 animate-fade-in">
                  <label className="block text-xs font-bold text-amber-900 mb-1">Select Specific Staff Member</label>
                  <select
                    value={taskForm.targetUserId}
                    onChange={e => setTaskForm({ ...taskForm, targetUserId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-amber-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                  >
                    {staffList.map(st => (
                      <option key={st.id} value={st.id}>{st.full_name} ({st.role.replace('_', ' ').toUpperCase()}) &bull; {st.email}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Priority Level</label>
                  <select
                    value={taskForm.priority}
                    onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Category</label>
                  <select
                    value={taskForm.category}
                    onChange={e => setTaskForm({ ...taskForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
                  >
                    <option value="Evaluation">Evaluation</option>
                    <option value="Governance">Governance</option>
                    <option value="Master Data">Master Data</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-purple-600" /> Due Date
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-[10px] font-semibold text-slate-500 hover:text-purple-600">
                      <input
                        type="checkbox"
                        checked={taskForm.hasNoDueDate}
                        onChange={e => setTaskForm({ ...taskForm, hasNoDueDate: e.target.checked })}
                        className="rounded text-purple-600 focus:ring-purple-500 w-3 h-3 cursor-pointer"
                      />
                      <span>No Due Date</span>
                    </label>
                  </div>
                  <input
                    type="date"
                    required={!taskForm.hasNoDueDate}
                    disabled={taskForm.hasNoDueDate}
                    value={taskForm.hasNoDueDate ? '' : taskForm.dueDate}
                    onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 ${
                      taskForm.hasNoDueDate ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'bg-slate-50 border-slate-200 cursor-pointer'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-purple-600" /> Daily Reminder
                  </label>
                  <select
                    disabled={taskForm.hasNoDueDate}
                    value={taskForm.reminderDaysBefore}
                    onChange={e => setTaskForm({ ...taskForm, reminderDaysBefore: parseInt(e.target.value, 10) })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 ${
                      taskForm.hasNoDueDate ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'bg-slate-50 border-slate-200 cursor-pointer'
                    }`}
                  >
                    <option value={1}>1 Day Before</option>
                    <option value={2}>2 Days Before</option>
                    <option value={3}>3 Days Before (Default)</option>
                    <option value={5}>5 Days Before</option>
                    <option value={7}>7 Days Before (1 Wk)</option>
                    <option value={0}>No Reminder</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  {editingTask ? 'Save Scoped Task' : 'Publish Scoped Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ANNOUNCEMENT MODAL */}
      {isAnnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in" onClick={() => setIsAnnModalOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs">
                  <Megaphone size={18} />
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {editingAnn ? 'Edit Announcement' : 'Post Announcement'}
                </h3>
              </div>
              <button onClick={() => setIsAnnModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Headline Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. District PSDS Alignment Meeting"
                  value={annForm.title}
                  onChange={e => setAnnForm({ ...annForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Content Body</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Write announcement details..."
                  value={annForm.content}
                  onChange={e => setAnnForm({ ...annForm, content: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Tag</label>
                  <select
                    value={annForm.tag}
                    onChange={e => setAnnForm({ ...annForm, tag: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="Important">Important</option>
                    <option value="System Update">System Update</option>
                    <option value="Event">Event</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Author / Office</label>
                  <input
                    type="text"
                    value={annForm.author}
                    onChange={e => setAnnForm({ ...annForm, author: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pin-check"
                  checked={annForm.isPinned}
                  onChange={e => setAnnForm({ ...annForm, isPinned: e.target.checked })}
                  className="rounded text-[#2563EB] focus:ring-[#2563EB]"
                />
                <label htmlFor="pin-check" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1">
                  <Pin size={13} className="text-amber-600" /> Pin announcement to top of list
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAnnModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  {editingAnn ? 'Save Changes' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. EVENT MODAL */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in" onClick={() => setIsEventModalOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs">
                  <CalendarDays size={18} />
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {editingEvent ? 'Edit Scheduled Event' : 'Schedule New Event'}
                </h3>
              </div>
              <button onClick={() => setIsEventModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Faculty Development Seminar"
                  value={eventForm.title}
                  onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#2563EB]" /> Event Date
                  </label>
                  <input
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={e => setEventForm({ ...eventForm, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] cursor-pointer font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 09:00 AM - 12:00 PM"
                    value={eventForm.time}
                    onChange={e => setEventForm({ ...eventForm, time: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Venue / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. District AVR"
                    value={eventForm.venue}
                    onChange={e => setEventForm({ ...eventForm, venue: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Category</label>
                  <select
                    value={eventForm.category}
                    onChange={e => setEventForm({ ...eventForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="Meeting">Meeting</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Audit">Audit</option>
                    <option value="Conference">Conference</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-900">Program Description & Notes</label>
                  <span className="text-[10px] text-slate-500">Supports headers (Where:), tags (AES-) & bullets (*)</span>
                </div>
                
                {/* Helper Format Buttons */}
                <div className="flex items-center gap-1 mb-2 flex-wrap text-[10px]">
                  <button
                    type="button"
                    onClick={() => setEventForm(prev => ({ ...prev, description: prev.description + (prev.description ? '\n' : '') + 'Where: ' }))}
                    className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-200 hover:bg-blue-100 cursor-pointer"
                  >
                    + Where:
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventForm(prev => ({ ...prev, description: prev.description + (prev.description ? '\n' : '') + 'Theme: ' }))}
                    className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 font-semibold border border-purple-200 hover:bg-purple-100 cursor-pointer"
                  >
                    + Theme:
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventForm(prev => ({ ...prev, description: prev.description + (prev.description ? '\n' : '') + '* ' }))}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold border border-slate-200 hover:bg-slate-200 cursor-pointer"
                  >
                    + Bullet (*)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventForm(prev => ({ ...prev, description: prev.description + (prev.description ? '\n' : '') + 'AES- ' }))}
                    className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                  >
                    + School (AES-)
                  </button>
                </div>

                <textarea
                  rows={5}
                  placeholder="Where: Venue Location&#10;Theme: Event Theme&#10;* Prepare items per school&#10;Food:&#10;AES- Lumpia/ Adobo&#10;BES- Buko Salad"
                  value={eventForm.description}
                  onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] font-mono leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  {editingEvent ? 'Save Changes' : 'Schedule Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. TASK COMPLIANCE MONITOR MODAL */}
      {isComplianceModalOpen && complianceTask && (() => {
        const targetedStaff = staffList.filter(st => {
          if (complianceTask.scopeType === 'district') return true
          if (complianceTask.scopeType === 'school' && complianceTask.targetSchoolId) {
            return (st.assigned_school_ids || []).includes(complianceTask.targetSchoolId)
          }
          if (complianceTask.scopeType === 'role' && complianceTask.targetRole) {
            return (
              st.role === complianceTask.targetRole ||
              (complianceTask.targetRole === 'admin' && st.role === 'ao_2' && !!st.district_name) ||
              (complianceTask.targetRole === 'ao_2' && (st.role === 'ao_2' || (st.role === 'admin' && (st.assigned_school_ids || []).length > 0)))
            )
          }
          if (complianceTask.scopeType === 'user' && complianceTask.targetUserId) {
            return st.id === complianceTask.targetUserId
          }
          return true
        })

        const completedMap = new Map(complianceRecords.map(r => [r.userId, r.completedAt]))
        const completedStaff = targetedStaff.filter(st => completedMap.has(st.id))
        const totalCount = targetedStaff.length
        const doneCount = completedStaff.length
        const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

        const displayedStaff = targetedStaff.filter(st => {
          if (complianceFilterTab === 'completed') return completedMap.has(st.id)
          if (complianceFilterTab === 'pending') return !completedMap.has(st.id)
          return true
        })

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in" onClick={() => setIsComplianceModalOpen(false)}>
            <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto font-sans" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight truncate">
                      Task Compliance & Completion Status
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      {complianceTask.title} &bull; {complianceTask.scopeType.toUpperCase()} Scope
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsComplianceModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* Progress Summary Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">Compliance Rate:</span>
                    <span className="font-bold text-[#2563EB] text-sm">{pct}%</span>
                    <span className="text-slate-500 font-medium">({doneCount} of {totalCount} Staff Completed)</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500">
                    Due Date: {formatDateForDisplay(complianceTask.dueDate)}
                  </div>
                </div>

                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-[#2563EB] rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Compliance Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold">
                <button
                  onClick={() => setComplianceFilterTab('all')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    complianceFilterTab === 'all' ? 'bg-white text-[#2563EB] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Targeted Staff ({totalCount})
                </button>
                <button
                  onClick={() => setComplianceFilterTab('completed')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    complianceFilterTab === 'completed' ? 'bg-white text-emerald-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Completed ({doneCount})
                </button>
                <button
                  onClick={() => setComplianceFilterTab('pending')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    complianceFilterTab === 'pending' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pending ({totalCount - doneCount})
                </button>
              </div>

              {/* Targeted Staff Cards List */}
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {isLoadingCompliance ? (
                  <div className="text-center py-8 text-xs font-semibold text-slate-500">
                    Loading compliance details from Supabase...
                  </div>
                ) : displayedStaff.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs font-semibold text-slate-500">
                    No staff members match this filter criteria
                  </div>
                ) : (
                  displayedStaff.map(st => {
                    const isDone = completedMap.has(st.id)
                    const school = schools.find(s => (st.assigned_school_ids || []).includes(s.id))

                    return (
                      <div
                        key={st.id}
                        className="p-3.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={st.avatar_url || "/images/clay/avatar_girl.jpg"}
                            alt={st.full_name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{st.full_name}</h4>
                            <p className="text-[10px] text-slate-500 font-medium truncate">
                              {st.role.replace('_', ' ').toUpperCase()} {school ? `• ${school.name}` : ''}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{st.email}</p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              <CheckSquare size={11} /> Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                              <Clock size={11} /> Pending
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsComplianceModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shadow-xs cursor-pointer"
                >
                  Close Monitor
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Account Settings Modal */}
      {shouldRenderSettingsModal && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
            isSettingsModalOpen ? 'opacity-100 backdrop-blur-md bg-black/40' : 'opacity-0 backdrop-blur-none bg-black/0 pointer-events-none'
          }`}
          onClick={() => setIsSettingsModalOpen(false)}
        >
          <div
            className={`w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl p-6 transition-all duration-300 ${
              isSettingsModalOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center border border-blue-100 shadow-2xs">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Account Settings</h2>
                  <p className="text-xs text-slate-500 font-medium">Update profile details, email & password</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveAccountSettings} className="mt-6 space-y-4">
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="relative">
                  <img
                    src={settingsAvatarUrl || admin?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'}
                    alt="Profile Avatar"
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-xs"
                  />
                  <label
                    htmlFor="hub-avatar-upload"
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-[#2563EB] text-white flex items-center justify-center cursor-pointer shadow-xs hover:bg-[#1D4ED8] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </label>
                  <input
                    id="hub-avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Profile Photo</h4>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Click icon to upload a custom image</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] font-medium"
                  placeholder="e.g. Christian S. Tolentino"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={settingsEmail}
                  onChange={(e) => setSettingsEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] font-medium"
                  placeholder="name@deped.gov.ph"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  New Password <span className="text-[10px] text-slate-400 font-normal">(Leave blank to keep unchanged)</span>
                </label>
                <div className="relative">
                  <input
                    type={settingsShowPassword ? 'text' : 'password'}
                    value={settingsPassword}
                    onChange={(e) => setSettingsPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] font-medium pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setSettingsShowPassword(!settingsShowPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {settingsShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingAccount ? 'Saving Changes...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Item Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={archiveDialog.isOpen}
        title={`Archive ${archiveDialog.type.charAt(0).toUpperCase() + archiveDialog.type.slice(1)}`}
        message={`Are you sure you want to archive "${archiveDialog.title}"? It will be moved to the archive list.`}
        confirmLabel="Archive"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={confirmArchiveItem}
        onCancel={() => setArchiveDialog({ isOpen: false, type: 'task', id: '', title: '' })}
      />

      {/* Task Completion Status Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={completeConfirmDialog.isOpen}
        title={completeConfirmDialog.willComplete ? "Complete Task Confirmation" : "Reopen Task Confirmation"}
        message={
          completeConfirmDialog.willComplete
            ? `Are you sure you want to mark "${completeConfirmDialog.taskTitle}" as COMPLETED?`
            : `Are you sure you want to reopen "${completeConfirmDialog.taskTitle}" as PENDING (incomplete)?`
        }
        confirmLabel={completeConfirmDialog.willComplete ? "Mark Completed" : "Mark Pending"}
        cancelLabel="Cancel"
        variant={completeConfirmDialog.willComplete ? "default" : "warning"}
        onConfirm={confirmToggleTaskComplete}
        onCancel={() => setCompleteConfirmDialog({ isOpen: false, taskId: '', taskTitle: '', willComplete: true })}
      />

      {/* Event Details Modal */}
      {viewingEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-xs animate-fade-in"
          onClick={() => setViewingEvent(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto animate-scale-up font-sans"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-5 gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-[#2563EB] flex items-center justify-center shrink-0 shadow-2xs">
                  <CalendarDays size={24} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200">
                      {viewingEvent.category}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      viewingEvent.isArchived ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {viewingEvent.isArchived ? 'Archived' : 'Active Schedule'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {viewingEvent.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setViewingEvent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold text-lg transition-all cursor-pointer shrink-0"
              >
                &times;
              </button>
            </div>

            {/* Event Summary Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-1.5 text-[#2563EB] text-[10px] font-bold uppercase tracking-wider">
                  <Calendar size={13} />
                  <span>Event Date</span>
                </div>
                <p className="text-xs font-bold text-slate-900">
                  {formatDateForDisplay(viewingEvent.date)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-1.5 text-[#2563EB] text-[10px] font-bold uppercase tracking-wider">
                  <Clock size={13} />
                  <span>Time Schedule</span>
                </div>
                <p className="text-xs font-bold text-slate-900">
                  {viewingEvent.time}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-1.5 text-rose-600 text-[10px] font-bold uppercase tracking-wider">
                  <MapPin size={13} />
                  <span>Location / Venue</span>
                </div>
                <p className="text-xs font-bold text-slate-900 truncate" title={viewingEvent.venue}>
                  {viewingEvent.venue}
                </p>
              </div>
            </div>

            {/* Formatted Event Description */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ScrollText size={15} className="text-[#2563EB]" />
                  <span>Event Details & Program Instructions</span>
                </h4>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {renderFormattedEventDescription(viewingEvent.description)}
              </div>
            </div>

            {/* Footer Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3">
              {canManageItem(viewingEvent.createdBy) ? (
                <button
                  type="button"
                  onClick={() => {
                    const evt = viewingEvent
                    setViewingEvent(null)
                    handleOpenEventModal(evt)
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Pencil size={15} />
                  <span>Edit Event Details</span>
                </button>
              ) : (
                <span className="text-xs font-medium text-slate-500">School Connect Official Event</span>
              )}

              <button
                type="button"
                onClick={() => setViewingEvent(null)}
                className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Logout Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to log out of School Connect? You will need to sign in again to access system features."
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  )
}



