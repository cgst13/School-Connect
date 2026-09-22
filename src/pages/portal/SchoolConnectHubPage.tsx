import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DepEdPageLoader } from '@/components/ui/DepEdSpinner'
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
  AlertTriangle
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
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    time: '',
    venue: '',
    category: 'Meeting',
    description: ''
  })

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
    <div className="min-h-screen relative bg-gradient-to-br from-[#F4EFFC] via-[#EBF3FE] to-[#FFF1F6] text-[#2D2638] flex flex-col font-sans px-4 sm:px-8 pb-8 pt-[116px] sm:pt-[136px] lg:pt-[148px] select-none overflow-x-hidden">
      {/* Responsive Fixed Non-Scrollable Background Wallpaper */}
      <picture className="fixed inset-0 w-screen h-[100dvh] min-h-[100dvh] overflow-hidden pointer-events-none z-0">
        <source media="(max-width: 768px)" srcSet="/images/bg-mobile.png" />
        <img
          src="/images/bg-desktop.png"
          alt="Background Wallpaper"
          className="w-screen h-[100dvh] min-h-[100dvh] object-cover object-center opacity-40 mix-blend-multiply transition-opacity duration-700 pointer-events-none"
        />
      </picture>

      {/* Dynamic Pastel Ambient Glow Orbs */}
      <div className="fixed top-[-12%] left-[-8%] w-[540px] h-[540px] rounded-full bg-gradient-to-tr from-[#DDD6FE]/50 to-[#C4B5FD]/30 blur-3xl pointer-events-none animate-float-slow z-0" />
      <div className="fixed top-[15%] right-[-8%] w-[580px] h-[580px] rounded-full bg-gradient-to-br from-[#BAE6FD]/50 to-[#93C5FD]/30 blur-3xl pointer-events-none animate-float-reverse z-0" />
      <div className="fixed bottom-[-10%] left-[10%] w-[520px] h-[520px] rounded-full bg-gradient-to-tr from-[#A7F3D0]/35 to-[#6EE7B7]/25 blur-3xl pointer-events-none animate-float-horizontal z-0" />
      <div className="fixed bottom-[5%] right-[12%] w-[480px] h-[480px] rounded-full bg-gradient-to-tl from-[#FECDD3]/40 to-[#FEF3C7]/45 blur-3xl pointer-events-none animate-pastel-pulse z-0" />

      {/* Subtle Micro-Grid Texture */}
      <div 
        className="fixed inset-0 w-screen h-[100dvh] opacity-[0.035] pointer-events-none z-0" 
        style={{ backgroundImage: `radial-gradient(#475569 1px, transparent 1px)`, backgroundSize: '28px 28px' }} 
      />

      {/* 3D Clay Top Header Navbar - Fixed at Top Screen Edge */}
      <header className="fixed top-0 left-0 right-0 m-0 mt-0 z-50 w-full bg-white/95 backdrop-blur-xl border-b border-white/80 px-4 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-4 shadow-[0_4px_25px_rgba(185,170,210,0.15)] rounded-none">
        {/* Official Logo Display & User Greeting */}
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/portal" className="flex items-center group shrink-0">
            <img
              src="/images/school_connect_logo.png"
              alt="School Connect Official Logo"
              className="h-14 sm:h-18 lg:h-20 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
            />
          </Link>
          
          <div className="hidden xs:block min-w-0 border-l border-slate-200/80 pl-4">
            <h1 className="text-base sm:text-xl font-black text-[#2D2638] tracking-tight flex items-center gap-1.5 font-display truncate">
              <span>Good day, {admin?.full_name?.split(' ')[0] || 'Administrator'}!</span>
              <span className="text-lg">👋</span>
            </h1>
            <p className="text-xs text-[#7A7289] font-medium hidden sm:block truncate">
              Welcome to School Connect Unified Portal
            </p>
          </div>
        </div>

        {/* User Profile / Auth Status */}
        <div className="flex items-center gap-3">
          {/* INTERACTIVE NOTIFICATION BELL */}
          <div className="relative">
            <button
              onClick={() => setIsNotifMenuOpen(prev => !prev)}
              className="relative p-2.5 rounded-full bg-white shadow-xs border border-white text-[#7A7289] hover:text-[#8B72F4] hover:shadow-md transition-all cursor-pointer flex items-center justify-center"
              title="View Unified Portal Notifications"
            >
              <Bell size={18} />
              {totalNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-[#FFE2E8] text-[#E11D48] text-[10px] font-black flex items-center justify-center border border-white shadow-xs animate-pulse">
                  {totalNotifCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Menu */}
            {isNotifMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsNotifMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white rounded-[28px] border-2 border-white shadow-[0_16px_36px_rgba(139,114,244,0.22)] z-50 p-4 space-y-3 animate-fade-in font-sans">
                  
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#F0E6DD]">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-[#8B72F4] text-white">
                        <Bell size={14} />
                      </div>
                      <h4 className="text-xs font-black text-[#2D2638] font-display">Notifications & Alerts</h4>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      {totalNotifCount} Active
                    </span>
                  </div>

                  {/* Filter Category Tabs */}
                  <div className="flex items-center gap-1 bg-[#FAF5F0] p-1 rounded-xl border border-white text-[10px] font-extrabold">
                    <button
                      onClick={() => setNotifTab('all')}
                      className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                        notifTab === 'all' ? 'bg-white text-[#8B72F4] shadow-xs' : 'text-[#7A7289]'
                      }`}
                    >
                      All ({totalNotifCount})
                    </button>
                    <button
                      onClick={() => setNotifTab('tasks')}
                      className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                        notifTab === 'tasks' ? 'bg-white text-[#8B72F4] shadow-xs' : 'text-[#7A7289]'
                      }`}
                    >
                      Tasks ({activeTasksNotif.length})
                    </button>
                    <button
                      onClick={() => setNotifTab('announcements')}
                      className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                        notifTab === 'announcements' ? 'bg-white text-[#F472B6] shadow-xs' : 'text-[#7A7289]'
                      }`}
                    >
                      News ({activeAnnouncementsNotif.length})
                    </button>
                    <button
                      onClick={() => setNotifTab('events')}
                      className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                        notifTab === 'events' ? 'bg-white text-[#3B82F6] shadow-xs' : 'text-[#7A7289]'
                      }`}
                    >
                      Events ({activeEventsNotif.length})
                    </button>
                  </div>

                  {/* Notifications Scroll List */}
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {totalNotifCount === 0 ? (
                      <div className="text-center py-6">
                        <Bell size={24} className="mx-auto text-purple-200 mb-1" />
                        <p className="text-xs font-bold text-[#7A7289]">All caught up!</p>
                        <p className="text-[10px] text-[#A39BAF] mt-0.5">No active notifications at this time.</p>
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
                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                                  isOver
                                    ? 'bg-rose-50/90 border-rose-200 hover:bg-rose-100/90'
                                    : isSoon
                                    ? 'bg-amber-50/90 border-amber-200 hover:bg-amber-100/90'
                                    : 'bg-purple-50/60 border-purple-100 hover:bg-purple-100/70'
                                }`}
                              >
                                <div className={`p-1.5 rounded-xl text-white shrink-0 mt-0.5 ${
                                  isOver ? 'bg-rose-500' : isSoon ? 'bg-amber-500 animate-bounce' : 'bg-[#8B72F4]'
                                }`}>
                                  {isOver ? <AlertTriangle size={12} /> : isSoon ? <Bell size={12} /> : <Target size={12} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <h5 className="text-xs font-extrabold text-[#2D2638] truncate">{t.title}</h5>
                                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full text-white ${
                                      isOver ? 'bg-rose-600' : isSoon ? 'bg-amber-500' : 'bg-[#8B72F4]'
                                    }`}>
                                      {isOver ? 'OVERDUE' : isSoon ? (days === 0 ? 'TODAY' : `${days}d LEFT`) : 'ASSIGNED'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#7A7289] font-medium mt-0.5 truncate">
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
                              className="p-3 rounded-2xl bg-pink-50/70 border border-pink-200 hover:bg-pink-100/80 transition-all cursor-pointer flex items-start gap-2.5"
                            >
                              <div className="p-1.5 rounded-xl bg-[#F472B6] text-white shrink-0 mt-0.5">
                                <Megaphone size={12} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <h5 className="text-xs font-extrabold text-[#2D2638] truncate">{a.title}</h5>
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-[#F472B6] text-white">
                                    NEWS
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#7A7289] font-medium mt-0.5 truncate">
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
                              className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200 hover:bg-blue-100/80 transition-all cursor-pointer flex items-start gap-2.5"
                            >
                              <div className="p-1.5 rounded-xl bg-[#3B82F6] text-white shrink-0 mt-0.5">
                                <CalendarDays size={12} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <h5 className="text-xs font-extrabold text-[#2D2638] truncate">{e.title}</h5>
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-[#3B82F6] text-white">
                                    EVENT
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#7A7289] font-medium mt-0.5 truncate">
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
                className="flex items-center gap-2.5 bg-white p-1.5 pr-3.5 rounded-full shadow-xs border border-white hover:bg-[#F6EFFF] hover:shadow-md transition-all cursor-pointer"
                title="Account Settings & User Profile"
              >
                <img
                  src={admin.avatar_url || "/images/clay/avatar_girl.jpg"}
                  alt="User Avatar"
                  className="w-8 h-8 rounded-full object-cover border border-white shadow-xs shrink-0 bg-[#F6EFFF]"
                />
                <div className="text-left hidden xs:block sm:block min-w-0">
                  <span className="text-xs font-black text-[#2D2638] truncate block leading-tight">
                    {admin.full_name}
                  </span>
                  <span className="text-[10px] font-bold text-[#8B72F4] uppercase tracking-wider block">
                    {admin.role === 'ao_2'
                      ? admin.district_name && admin.assigned_school_ids && admin.assigned_school_ids.length > 0
                        ? 'AO II (District & School Admin)'
                        : admin.district_name
                        ? 'AO II (District Admin)'
                        : 'AO II'
                      : admin.role === 'school_head'
                      ? 'School Head'
                      : admin.role === 'psds'
                      ? 'PSDS'
                      : admin.role === 'teacher'
                      ? 'Teacher'
                      : 'System Admin'}
                  </span>
                </div>
                <ChevronDown size={14} className={`text-[#7A7289] transition-transform duration-200 ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Account Quick Dropdown Menu */}
              {isAccountMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAccountMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-[28px] border-2 border-white shadow-[0_16px_36px_rgba(139,114,244,0.22)] z-50 p-3 space-y-2 animate-fade-in font-sans">
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-[#F6EFFF] via-[#EEF0FF] to-[#FAF5F0] border border-[#8B72F4]/20 flex items-center gap-3">
                      <img
                        src={admin.avatar_url || "/images/clay/avatar_girl.jpg"}
                        alt="User Avatar"
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black text-[#2D2638] truncate font-display">{admin.full_name}</h4>
                        <p className="text-[10px] font-semibold text-[#7A7289] truncate">{admin.email}</p>
                        <span className="inline-block px-2 py-0.5 mt-1 rounded-full text-[9px] font-extrabold bg-[#8B72F4] text-white shadow-2xs">
                          {admin.role.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <button
                        onClick={(e) => {
                          setIsAccountMenuOpen(false)
                          handleOpenSettings(e)
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold text-[#2D2638] hover:bg-[#F6EFFF] hover:text-[#8B72F4] transition-all cursor-pointer text-left"
                      >
                        <div className="p-2 rounded-xl bg-[#FAF5F0] text-[#8B72F4] shadow-2xs">
                          <Settings size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block leading-tight font-black">Account Settings</span>
                          <span className="text-[10px] text-[#7A7289] font-medium block">Update Name, Email & Password</span>
                        </div>
                      </button>

                      <button
                        onClick={(e) => {
                          setIsAccountMenuOpen(false)
                          captureGenieOrigin(e)
                          setShowLogoutConfirm(true)
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold text-[#E11D48] hover:bg-rose-50 transition-all cursor-pointer text-left"
                      >
                        <div className="p-2 rounded-xl bg-rose-50 text-[#E11D48] shadow-2xs">
                          <LogOut size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block leading-tight font-black">Sign Out</span>
                          <span className="text-[10px] text-rose-400 font-medium block">End current session</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] shadow-md transition-all flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              Portal Login
            </Link>
          )}
        </div>
      </header>

      {/* Main Content Shell with 2-Column Responsive Layout */}
      <main className="relative z-10 flex-1 w-full space-y-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* LEFT COLUMN: Systems Grid, Master Data, Announcements & Events */}
          <div className="flex-1 min-w-0 space-y-6 w-full">

            {/* Systems & Applications Card */}
            <div className="clay-card p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-100 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#A88BEB] to-[#8B72F4] text-white flex items-center justify-center shadow-md border border-white">
                    <Grid className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#2D2638] tracking-tight font-display">School Systems & Applications</h3>
                    <p className="text-xs text-[#7A7289] font-medium">Core educational applications, evaluation engines & record systems</p>
                  </div>
                </div>

                {/* Inset Search Input Pill */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#A39BAF]" />
                  <input
                    type="text"
                    placeholder="Search systems..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 rounded-full text-xs bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 focus:bg-white transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Systems Grid */}
              {loadingData ? (
                <div className="py-12 bg-white/80 rounded-[32px] border border-white">
                  <DepEdPageLoader
                    label="Loading School Connect Portal Hub..."
                    subtitle="Fetching District Announcements, Tasks, and Calendar Events"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredSystems.map((sys) => {
                    const Icon = sys.icon
                    const isActive = sys.enabled

                    return (
                      <div
                        key={sys.id}
                        onClick={() => handleLaunchSystem(sys)}
                        className={`p-5 rounded-[28px] transition-all duration-300 flex items-center justify-between gap-4 group ${
                          isActive
                            ? 'bg-white shadow-[0_10px_25px_rgba(185,170,210,0.15)] border border-white/90 hover:shadow-lg hover:-translate-y-1 cursor-pointer'
                            : 'bg-[#FAF5F0]/60 opacity-60 cursor-not-allowed border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-white ${
                            isActive
                              ? 'bg-gradient-to-tr from-[#A88BEB] to-[#8B72F4] text-white shadow-md'
                              : 'bg-slate-200 text-slate-400'
                          }`}>
                            <Icon className="w-6 h-6" />
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-[#2D2638] truncate font-display group-hover:text-[#8B72F4] transition-colors">
                              {sys.name}
                            </h4>
                            <p className="text-[11px] text-[#7A7289] truncate font-medium mt-0.5">
                              {sys.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full whitespace-nowrap ${
                            isActive
                              ? 'clay-badge-purple'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            {sys.badgeText || (isActive ? 'Active' : 'Soon')}
                          </span>
                          {isActive ? (
                            <ChevronRight className="w-4 h-4 text-[#A39BAF] group-hover:text-[#8B72F4] transition-transform group-hover:translate-x-1" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-[#A39BAF]" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Global Governance & Master Data Section (Above Announcements & Events) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">

              {/* 1. Academic Structure & Master Data */}
              <div className="clay-card p-6 sm:p-7 space-y-5">
                <div className="flex items-center gap-3 border-b border-purple-100 pb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#A88BEB] to-[#8B72F4] text-white flex items-center justify-center border border-white shadow-md shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#2D2638] tracking-tight font-display">Academic Structure & Master Data</h3>
                    <p className="text-xs text-[#7A7289] font-medium">Schools, learning areas, and academic calendars</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Link
                    to="/admin/schools"
                    className="p-4.5 rounded-[24px] bg-white/90 shadow-[0_8px_20px_rgba(185,170,210,0.12)] border-2 border-white hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#A88BEB] to-[#8B72F4] text-white flex items-center justify-center shrink-0 shadow-md border border-white">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-[#2D2638] group-hover:text-[#8B72F4] truncate transition-colors">Schools Directory</h4>
                        <p className="text-[10px] text-[#7A7289] truncate font-semibold mt-0.5">School list & type setup</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#A39BAF] group-hover:text-[#8B72F4] transition-transform group-hover:translate-x-1 flex-shrink-0" />
                  </Link>

                  <Link
                    to="/admin/learning-areas"
                    className="p-4.5 rounded-[24px] bg-white/90 shadow-[0_8px_20px_rgba(185,170,210,0.12)] border-2 border-white hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#86EFAC] to-[#34D399] text-white flex items-center justify-center shrink-0 shadow-md border border-white">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-[#2D2638] group-hover:text-[#047857] truncate transition-colors">Learning Areas</h4>
                        <p className="text-[10px] text-[#7A7289] truncate font-semibold mt-0.5">Subjects & grade mapping</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#A39BAF] group-hover:text-[#047857] transition-transform group-hover:translate-x-1 flex-shrink-0" />
                  </Link>

                  <Link
                    to="/admin/school-years"
                    className="p-4.5 rounded-[24px] bg-white/90 shadow-[0_8px_20px_rgba(185,170,210,0.12)] border-2 border-white hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#93C5FD] to-[#60A5FA] text-white flex items-center justify-center shrink-0 shadow-md border border-white">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-[#2D2638] group-hover:text-[#2563EB] truncate transition-colors">School Years</h4>
                        <p className="text-[10px] text-[#7A7289] truncate font-semibold mt-0.5">Academic calendar years</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#A39BAF] group-hover:text-[#2563EB] transition-transform group-hover:translate-x-1 flex-shrink-0" />
                  </Link>

                  <Link
                    to="/admin/terms"
                    className="p-4.5 rounded-[24px] bg-white/90 shadow-[0_8px_20px_rgba(185,170,210,0.12)] border-2 border-white hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FDE047] to-[#FACC15] text-[#713F12] flex items-center justify-center shrink-0 shadow-md border border-white">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-[#2D2638] group-hover:text-[#B45309] truncate transition-colors">Terms & Quarters</h4>
                        <p className="text-[10px] text-[#7A7289] truncate font-semibold mt-0.5">Active evaluation terms</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#A39BAF] group-hover:text-[#B45309] transition-transform group-hover:translate-x-1 flex-shrink-0" />
                  </Link>
                </div>
              </div>

              {/* 2. Platform Administration & Security (Always rendered; disabled for non-admin users) */}
              <div className="clay-card p-6 sm:p-7 space-y-5">
                <div className="flex items-center justify-between border-b border-purple-100 pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl ${isAdminUser ? 'bg-gradient-to-tr from-[#F9A8D4] to-[#F472B6]' : 'bg-slate-300 dark:bg-slate-700'} text-white flex items-center justify-center border border-white shadow-md shrink-0`}>
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-[#2D2638] tracking-tight font-display truncate">Platform Administration & Staff</h3>
                      <p className="text-xs text-[#7A7289] font-medium truncate">Personnel, superadmins, audit logs & settings</p>
                    </div>
                  </div>
                  {!isAdminUser && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs shrink-0">
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Admin Access Required</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {isAdminUser ? (
                    <Link
                      to="/portal/staff"
                      className="p-4.5 rounded-[24px] bg-white/90 shadow-[0_8px_20px_rgba(185,170,210,0.12)] border-2 border-white hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#F9A8D4] to-[#F472B6] text-white flex items-center justify-center shrink-0 shadow-md border border-white">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-[#2D2638] group-hover:text-[#DB2777] truncate transition-colors">Faculty & Staff</h4>
                          <p className="text-[10px] text-[#7A7289] truncate font-semibold mt-0.5">Personnel & assignments</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A39BAF] group-hover:text-[#DB2777] transition-transform group-hover:translate-x-1 flex-shrink-0" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRestrictedAdminClick}
                      className="p-4.5 rounded-[24px] bg-slate-100/80 border-2 border-slate-200/80 opacity-60 cursor-not-allowed flex items-center justify-between gap-3 text-left w-full transition-all group"
                      title="Admin access required"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 border border-white">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-600 truncate">Faculty & Staff</h4>
                          <p className="text-[10px] text-slate-400 truncate font-semibold mt-0.5">Personnel & assignments</p>
                        </div>
                      </div>
                      <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </button>
                  )}

                  {isAdminUser ? (
                    <Link
                      to="/admin/administrators"
                      className="p-4.5 rounded-[24px] bg-white/90 shadow-[0_8px_20px_rgba(185,170,210,0.12)] border-2 border-white hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#C084FC] to-[#A855F7] text-white flex items-center justify-center shrink-0 shadow-md border border-white">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-[#2D2638] group-hover:text-[#9333EA] truncate transition-colors">Administrators</h4>
                          <p className="text-[10px] text-[#7A7289] truncate font-semibold mt-0.5">Superadmin accounts</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A39BAF] group-hover:text-[#9333EA] transition-transform group-hover:translate-x-1 flex-shrink-0" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRestrictedAdminClick}
                      className="p-4.5 rounded-[24px] bg-slate-100/80 border-2 border-slate-200/80 opacity-60 cursor-not-allowed flex items-center justify-between gap-3 text-left w-full transition-all group"
                      title="Admin access required"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 border border-white">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-600 truncate">Administrators</h4>
                          <p className="text-[10px] text-slate-400 truncate font-semibold mt-0.5">Superadmin accounts</p>
                        </div>
                      </div>
                      <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </button>
                  )}

                  {isAdminUser ? (
                    <Link
                      to="/admin/audit-logs"
                      className="p-4.5 rounded-[24px] bg-white/90 shadow-[0_8px_20px_rgba(185,170,210,0.12)] border-2 border-white hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#6EE7B7] to-[#10B981] text-white flex items-center justify-center shrink-0 shadow-md border border-white">
                          <ScrollText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-[#2D2638] group-hover:text-[#059669] truncate transition-colors">Audit Logs</h4>
                          <p className="text-[10px] text-[#7A7289] truncate font-semibold mt-0.5">Platform activity log</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A39BAF] group-hover:text-[#059669] transition-transform group-hover:translate-x-1 flex-shrink-0" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRestrictedAdminClick}
                      className="p-4.5 rounded-[24px] bg-slate-100/80 border-2 border-slate-200/80 opacity-60 cursor-not-allowed flex items-center justify-between gap-3 text-left w-full transition-all group"
                      title="Admin access required"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 border border-white">
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
                      className="p-4.5 rounded-[24px] bg-white/90 shadow-[0_8px_20px_rgba(185,170,210,0.12)] border-2 border-white hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#DDD6FE] to-[#A78BFA] text-white flex items-center justify-center shrink-0 shadow-md border border-white">
                          <Settings className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-[#2D2638] group-hover:text-[#7C3AED] truncate transition-colors">System Settings</h4>
                          <p className="text-[10px] text-[#7A7289] truncate font-semibold mt-0.5">Configuration & backups</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#A39BAF] group-hover:text-[#7C3AED] transition-transform group-hover:translate-x-1 flex-shrink-0" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRestrictedAdminClick}
                      className="p-4.5 rounded-[24px] bg-slate-100/80 border-2 border-slate-200/80 opacity-60 cursor-not-allowed flex items-center justify-between gap-3 text-left w-full transition-all group"
                      title="Admin access required"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 border border-white">
                          <Settings className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-600 truncate">System Settings</h4>
                          <p className="text-[10px] text-slate-400 truncate font-semibold mt-0.5">Configuration & backups</p>
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
              <div id="announcements-widget" className="clay-card p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#F0E6DD]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#F9A8D4] to-[#F472B6] text-white shadow-xs">
                      <Megaphone size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-[#2D2638] font-display">Announcements</h3>
                      <p className="text-[10px] text-[#7A7289] font-medium">District bulletins & news</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Active vs Archived Tab Switcher */}
                    <div className="flex items-center gap-1 bg-[#FAF5F0] p-1 rounded-xl border border-white text-[10px] font-extrabold">
                      <button
                        onClick={() => setAnnTab('active')}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          annTab === 'active' ? 'bg-white text-[#F472B6] shadow-xs' : 'text-[#7A7289]'
                        }`}
                      >
                        Active ({announcements.filter(a => !a.isArchived).length})
                      </button>
                      <button
                        onClick={() => setAnnTab('archived')}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          annTab === 'archived' ? 'bg-white text-[#F472B6] shadow-xs' : 'text-[#7A7289]'
                        }`}
                      >
                        Archived ({announcements.filter(a => a.isArchived).length})
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenAnnModal()}
                      className="p-2 rounded-xl bg-gradient-to-r from-[#F472B6] to-[#F9A8D4] text-white text-xs font-black shadow-xs hover:shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
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
                    <div className="text-center py-6 bg-white/60 rounded-2xl border border-dashed border-pink-200">
                      <Megaphone size={24} className="mx-auto text-pink-300 mb-1" />
                      <p className="text-xs font-bold text-[#7A7289]">
                        {annTab === 'archived' ? 'No archived announcements' : 'No announcements posted'}
                      </p>
                    </div>
                  ) : (
                    displayedAnnouncements.map(ann => {
                      const canManageAnn = canManageItem(ann.authorId)

                      return (
                        <div key={ann.id} className={`p-4 rounded-2xl border-2 space-y-2 relative overflow-hidden group ${
                          ann.isArchived ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-white border-white shadow-2xs'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/20">
                                {ann.tag}
                              </span>
                              {ann.isPinned && !ann.isArchived && (
                                <span className="text-amber-700 flex items-center gap-1 text-[9px] font-extrabold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  <Pin size={10} /> Pinned
                                </span>
                              )}
                              {ann.isArchived && (
                                <span className="text-slate-600 flex items-center gap-1 text-[9px] font-extrabold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300">
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
                                        ann.isPinned ? 'text-amber-600 bg-amber-50' : 'text-[#A39BAF] hover:text-amber-600 hover:bg-amber-50'
                                      }`}
                                      title={ann.isPinned ? 'Unpin' : 'Pin to Top'}
                                    >
                                      <Pin size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleOpenAnnModal(ann)}
                                      className="p-1 rounded-lg text-[#7A7289] hover:text-[#8B72F4] hover:bg-purple-50 transition-all cursor-pointer"
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
                                      className="p-1 rounded-lg text-[#7A7289] hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer"
                                      title="Archive Announcement"
                                    >
                                      <Archive size={12} />
                                    </button>
                                  </>
                                )}
                                {ann.isArchived && (
                                  <button
                                    onClick={() => handleUnarchiveItem('announcement', ann.id)}
                                    className="p-1 rounded-lg text-[#7A7289] hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                                    title="Restore / Unarchive Announcement"
                                  >
                                    <ArchiveRestore size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <h4 className="text-xs font-black text-[#2D2638] leading-snug">{ann.title}</h4>
                          <p className="text-[11px] text-[#7A7289] leading-relaxed font-medium">{ann.content}</p>

                          <div className="pt-2 border-t border-[#FAF5F0] flex items-center justify-between text-[10px] text-[#A39BAF] font-semibold">
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
              <div id="events-widget" className="clay-card p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#F0E6DD]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#60A5FA] to-[#3B82F6] text-white shadow-xs">
                      <CalendarDays size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-[#2D2638] font-display">Upcoming Events</h3>
                      <p className="text-[10px] text-[#7A7289] font-medium">District schedule & activities</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Active vs Archived Tab Switcher */}
                    <div className="flex items-center gap-1 bg-[#FAF5F0] p-1 rounded-xl border border-white text-[10px] font-extrabold">
                      <button
                        onClick={() => setEventTab('active')}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          eventTab === 'active' ? 'bg-white text-[#3B82F6] shadow-xs' : 'text-[#7A7289]'
                        }`}
                      >
                        Active ({events.filter(e => !e.isArchived).length})
                      </button>
                      <button
                        onClick={() => setEventTab('archived')}
                        className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                          eventTab === 'archived' ? 'bg-white text-[#3B82F6] shadow-xs' : 'text-[#7A7289]'
                        }`}
                      >
                        Archived ({events.filter(e => e.isArchived).length})
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenEventModal()}
                      className="p-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white text-xs font-black shadow-xs hover:shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
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
                    <div className="text-center py-6 bg-white/60 rounded-2xl border border-dashed border-blue-200">
                      <CalendarDays size={24} className="mx-auto text-blue-300 mb-1" />
                      <p className="text-xs font-bold text-[#7A7289]">
                        {eventTab === 'archived' ? 'No archived events' : 'No upcoming events'}
                      </p>
                    </div>
                  ) : (
                    displayedEvents.map(evt => {
                      const canManageEvt = canManageItem(evt.createdBy)

                      return (
                        <div key={evt.id} className={`p-4 rounded-2xl border-2 space-y-2 relative group ${
                          evt.isArchived ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-white border-white shadow-2xs'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                              {evt.category}
                            </span>
                            
                            {/* Event Controls */}
                            {canManageEvt && (
                              <div className="flex items-center gap-1">
                                {!evt.isArchived && (
                                  <>
                                    <button
                                      onClick={() => handleOpenEventModal(evt)}
                                      className="p-1 rounded-lg text-[#7A7289] hover:text-[#3B82F6] hover:bg-blue-50 transition-all cursor-pointer"
                                      title="Edit Event"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      onClick={() => setArchiveDialog({
                                        isOpen: true,
                                        type: 'event',
                                        id: evt.id,
                                        title: evt.title
                                      })}
                                      className="p-1 rounded-lg text-[#7A7289] hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer"
                                      title="Archive Event"
                                    >
                                      <Archive size={12} />
                                    </button>
                                  </>
                                )}
                                {evt.isArchived && (
                                  <button
                                    onClick={() => handleUnarchiveItem('event', evt.id)}
                                    className="p-1 rounded-lg text-[#7A7289] hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                                    title="Restore / Unarchive Event"
                                  >
                                    <ArchiveRestore size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <h4 className="text-xs font-black text-[#2D2638] leading-snug">{evt.title}</h4>
                          {evt.description && (
                            <p className="text-[11px] text-[#7A7289] leading-relaxed font-medium">{evt.description}</p>
                          )}

                          <div className="pt-2 border-t border-[#FAF5F0] space-y-1 text-[10px] text-[#7A7289] font-medium">
                            <div className="flex items-center gap-1.5 text-blue-800 font-bold">
                              <Calendar size={11} className="text-blue-500" />
                              <span>{formatDateForDisplay(evt.date)}</span>
                              <span>&bull;</span>
                              <Clock size={11} className="text-blue-500" />
                              <span>{evt.time}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[#7A7289]">
                              <MapPin size={11} className="text-rose-400 shrink-0" />
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
            <div id="tasks-management-widget" className="clay-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0E6DD]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#A88BEB] to-[#8B72F4] text-white shadow-xs">
                    <CheckSquare size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#2D2638] font-display">Tasks Management</h3>
                    <p className="text-[10px] text-[#7A7289] font-medium">Scoped tasks & compliance</p>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenTaskModal()}
                  className="p-2 rounded-xl bg-gradient-to-r from-[#8B72F4] to-[#A88BEB] text-white text-xs font-black shadow-xs hover:shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                  title="Add New Task with Scope"
                >
                  <Plus size={15} />
                  <span className="hidden xs:inline">Task</span>
                </button>
              </div>

              {/* Task Quick Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#FAF5F0] p-1 rounded-2xl border border-white text-[10px] font-extrabold">
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                    taskFilter === 'all'
                      ? 'bg-white text-[#8B72F4] shadow-xs'
                      : 'text-[#7A7289] hover:text-[#2D2638]'
                  }`}
                >
                  All ({tasks.filter(t => !t.isArchived).length})
                </button>
                <button
                  onClick={() => setTaskFilter('pending')}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                    taskFilter === 'pending'
                      ? 'bg-white text-[#8B72F4] shadow-xs'
                      : 'text-[#7A7289] hover:text-[#2D2638]'
                  }`}
                >
                  Pending ({tasks.filter(t => !t.completed && !t.isArchived).length})
                </button>
                <button
                  onClick={() => setTaskFilter('completed')}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                    taskFilter === 'completed'
                      ? 'bg-white text-[#8B72F4] shadow-xs'
                      : 'text-[#7A7289] hover:text-[#2D2638]'
                  }`}
                >
                  Done ({tasks.filter(t => t.completed && !t.isArchived).length})
                </button>
                <button
                  onClick={() => setTaskFilter('archived')}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                    taskFilter === 'archived'
                      ? 'bg-white text-[#8B72F4] shadow-xs'
                      : 'text-[#7A7289] hover:text-[#2D2638]'
                  }`}
                >
                  Archive ({tasks.filter(t => t.isArchived).length})
                </button>
              </div>

              {/* Active Daily Reminder Banner */}
              {activeTaskReminders.length > 0 && (
                <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 animate-fade-in flex items-start gap-2.5 shadow-2xs">
                  <div className="p-1.5 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5 animate-bounce">
                    <Bell size={13} />
                  </div>
                  <div className="text-xs min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-black text-amber-900 leading-tight">Task Notification Alert</p>
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[9px] font-black">
                        {activeTaskReminders.length} Active
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-800 font-medium mt-0.5 leading-tight">
                      {activeTaskReminders.some(t => getDaysRemaining(t.dueDate) < 0)
                        ? 'Urgent attention required: You have overdue task(s) needing completion.'
                        : `Daily reminder active for task(s) due within notification window.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Task Items List */}
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-6 bg-white/60 rounded-2xl border border-dashed border-purple-200">
                    <CheckSquare size={24} className="mx-auto text-purple-300 mb-1" />
                    <p className="text-xs font-bold text-[#7A7289]">No tasks in this view</p>
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
                        className={`p-3.5 rounded-2xl border-2 transition-all group flex items-start gap-3 select-none ${
                          task.isArchived
                            ? 'bg-slate-50 border-slate-200 opacity-75'
                            : task.completed
                            ? 'bg-[#FAF5F0]/60 border-white opacity-70'
                            : isOverdue
                            ? 'bg-rose-50/90 border-rose-300 shadow-xs hover:bg-rose-100/90'
                            : isDueSoon
                            ? 'bg-amber-50/90 border-amber-300 shadow-xs hover:bg-amber-100/90'
                            : 'bg-white border-white hover:bg-[#F6EFFF] shadow-2xs'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={task.isArchived}
                          onClick={() => handleRequestToggleComplete(task)}
                          className={`mt-0.5 shrink-0 rounded-lg p-0.5 transition-colors ${
                            task.isArchived ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                          } ${
                            task.completed ? 'text-emerald-500' : 'text-[#A39BAF] hover:text-[#8B72F4]'
                          }`}
                          title={task.completed ? 'Mark pending' : 'Mark completed'}
                        >
                          {task.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        
                        <div className="min-w-0 flex-1">
                          <h4
                            onClick={() => !task.isArchived && handleRequestToggleComplete(task)}
                            className={`text-xs font-bold leading-snug ${task.isArchived ? '' : 'cursor-pointer'} ${
                              task.completed ? 'line-through text-[#7A7289]' : 'text-[#2D2638]'
                            }`}
                          >
                            {task.title}
                          </h4>

                          {/* Scope Target Pill Badge */}
                          <div className="mt-1 flex items-center gap-1 flex-wrap text-[9px] font-extrabold text-[#7A7289]">
                            {task.scopeType === 'district' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-purple-50 text-[#8B72F4] border border-purple-200">
                                <Globe size={9} /> District Wide
                              </span>
                            )}
                            {task.scopeType === 'school' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200" title="Assigned to all staff of school">
                                <SchoolIcon size={9} /> {schoolName || 'School Wide'}
                              </span>
                            )}
                            {task.scopeType === 'role' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200" title="Assigned to position role">
                                <Briefcase size={9} /> {task.targetRole?.replace('_', ' ').toUpperCase()} Scope
                              </span>
                            )}
                            {task.scopeType === 'user' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-200" title="Assigned to specific staff">
                                <UserCheck size={9} /> {targetUserName || 'Specific User'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {/* Priority Level Badge */}
                            <span className={`text-[9px] font-extrabold px-2 py-0.2 rounded-full ${
                              task.priority === 'high'
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : task.priority === 'medium'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {task.priority.toUpperCase()}
                            </span>

                            {/* Color-Coded Due Date / Urgency Status Badge */}
                            {!task.dueDate ? (
                              <span className="text-[9px] font-extrabold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                No Due Date
                              </span>
                            ) : isOverdue ? (
                              <span className="text-[9px] font-black px-2 py-0.2 rounded-full bg-rose-600 text-white shadow-2xs flex items-center gap-1">
                                <AlertTriangle size={9} /> OVERDUE ({Math.abs(daysRemaining)}d ago)
                              </span>
                            ) : isDueSoon ? (
                              <span className="text-[9px] font-black px-2 py-0.2 rounded-full bg-amber-500 text-white shadow-2xs flex items-center gap-1">
                                <Bell size={9} className="animate-bounce" /> {daysRemaining === 0 ? 'DUE TODAY' : `DUE IN ${daysRemaining} DAY${daysRemaining === 1 ? '' : 'S'}`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#7A7289] font-semibold flex items-center gap-1">
                                <Clock size={11} /> {formatDateForDisplay(task.dueDate)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Edit & Archive Action Buttons */}
                        {canManageTask && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!task.isArchived && (
                              <>
                                <button
                                  onClick={() => handleOpenComplianceModal(task)}
                                  className="p-1 rounded-lg text-[#7A7289] hover:text-[#8B72F4] hover:bg-white transition-all cursor-pointer"
                                  title="View Staff Task Compliance Status"
                                >
                                  <Eye size={13} />
                                </button>
                                <button
                                  onClick={() => handleOpenTaskModal(task)}
                                  className="p-1 rounded-lg text-[#7A7289] hover:text-[#8B72F4] hover:bg-white transition-all cursor-pointer"
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
                                  className="p-1 rounded-lg text-[#7A7289] hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer"
                                  title="Archive Task"
                                >
                                  <Archive size={13} />
                                </button>
                              </>
                            )}
                            {task.isArchived && (
                              <button
                                onClick={() => handleUnarchiveItem('task', task.id)}
                                className="p-1 rounded-lg text-[#7A7289] hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
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
      <footer className="w-full bg-white/70 backdrop-blur-md rounded-[32px] border border-white/80 p-5 text-center text-xs text-[#7A7289]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#2D2638]">School Connect System Platform</span>
            <span>&bull;</span>
            <span className="font-medium">All Educational Modules Integrated</span>
          </div>
          <div className="text-[11px] text-[#A39BAF] font-bold">
            Department of Education &bull; Integrated Systems
          </div>
        </div>
      </footer>

      {/* --- MODAL DIALOGS --- */}

      {/* 1. SCOPED TASK MODAL */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in" onClick={() => setIsTaskModalOpen(false)}>
          <div className="w-full max-w-lg bg-[#FAF5F0] rounded-[32px] border-4 border-white shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-[#8B72F4] text-white shadow-xs">
                  <Target size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#2D2638] font-display">
                    {editingTask ? 'Edit Scoped Task' : 'Create Scoped Task'}
                  </h3>
                  <p className="text-[10px] text-[#7A7289] font-medium">Assign tasks to District, Schools, Positions or Staff</p>
                </div>
              </div>
              <button onClick={() => setIsTaskModalOpen(false)} className="p-1 rounded-xl text-[#7A7289] hover:bg-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2D2638] mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Submit TERMCAT Quarter Reports"
                  value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40"
                />
              </div>

              {/* SCOPE SELECTOR RADIO CARDS */}
              <div>
                <label className="block text-xs font-bold text-[#2D2638] mb-1.5 flex items-center gap-1">
                  <Target size={13} className="text-[#8B72F4]" /> Assignment Scope & Compliance Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskForm({ ...taskForm, scopeType: 'district' })}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      taskForm.scopeType === 'district'
                        ? 'bg-purple-50 border-[#8B72F4] text-[#8B72F4] shadow-xs'
                        : 'bg-white border-purple-100 text-[#7A7289] hover:bg-purple-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-xs">
                      <Globe size={15} /> District Wide
                    </div>
                    <p className="text-[10px] font-medium mt-1 leading-tight text-[#7A7289]">All staff in district must comply</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaskForm({ ...taskForm, scopeType: 'school' })}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      taskForm.scopeType === 'school'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                        : 'bg-white border-purple-100 text-[#7A7289] hover:bg-emerald-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-xs">
                      <SchoolIcon size={15} /> Target School
                    </div>
                    <p className="text-[10px] font-medium mt-1 leading-tight text-[#7A7289]">All staff of school comply</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaskForm({ ...taskForm, scopeType: 'role' })}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      taskForm.scopeType === 'role'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-xs'
                        : 'bg-white border-purple-100 text-[#7A7289] hover:bg-blue-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-xs">
                      <Briefcase size={15} /> Target Position
                    </div>
                    <p className="text-[10px] font-medium mt-1 leading-tight text-[#7A7289]">All personnel in role comply</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaskForm({ ...taskForm, scopeType: 'user' })}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      taskForm.scopeType === 'user'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-xs'
                        : 'bg-white border-purple-100 text-[#7A7289] hover:bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-xs">
                      <UserCheck size={15} /> Specific Staff
                    </div>
                    <p className="text-[10px] font-medium mt-1 leading-tight text-[#7A7289]">Target single person</p>
                  </button>
                </div>
              </div>

              {/* DYNAMIC SCOPE SELECTION DROPDOWNS */}
              {taskForm.scopeType === 'school' && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 animate-fade-in">
                  <label className="block text-xs font-bold text-emerald-900 mb-1">Select Target School</label>
                  <select
                    value={taskForm.targetSchoolId}
                    onChange={e => setTaskForm({ ...taskForm, targetSchoolId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-300 text-xs font-bold text-[#2D2638]"
                  >
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.school_type.toUpperCase()})</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-emerald-700 font-semibold mt-1.5">
                    💡 All staff assigned to this school will be required to complete this task.
                  </p>
                </div>
              )}

              {taskForm.scopeType === 'role' && (
                <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 animate-fade-in">
                  <label className="block text-xs font-bold text-blue-900 mb-1">Select Target Position / Role</label>
                  <select
                    value={taskForm.targetRole}
                    onChange={e => setTaskForm({ ...taskForm, targetRole: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-blue-300 text-xs font-bold text-[#2D2638]"
                  >
                    <option value="ao_2">Administrative Officer II (AO II)</option>
                    <option value="school_head">School Heads</option>
                    <option value="teacher">Teachers</option>
                    <option value="psds">PSDS District Supervisors</option>
                    <option value="admin">System Admin</option>
                  </select>
                  <p className="text-[10px] text-blue-700 font-semibold mt-1.5">
                    💡 All personnel holding this position across schools will be required to comply.
                  </p>
                </div>
              )}

              {taskForm.scopeType === 'user' && (
                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 animate-fade-in">
                  <label className="block text-xs font-bold text-amber-900 mb-1">Select Specific Staff Member</label>
                  <select
                    value={taskForm.targetUserId}
                    onChange={e => setTaskForm({ ...taskForm, targetUserId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs font-bold text-[#2D2638]"
                  >
                    {staffList.map(st => (
                      <option key={st.id} value={st.id}>{st.full_name} ({st.role.replace('_', ' ').toUpperCase()}) &bull; {st.email}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1">Priority Level</label>
                  <select
                    value={taskForm.priority}
                    onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1">Category</label>
                  <select
                    value={taskForm.category}
                    onChange={e => setTaskForm({ ...taskForm, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40"
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
                    <label className="block text-xs font-bold text-[#2D2638] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#8B72F4]" /> Due Date
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-[#7A7289] hover:text-[#8B72F4]">
                      <input
                        type="checkbox"
                        checked={taskForm.hasNoDueDate}
                        onChange={e => setTaskForm({ ...taskForm, hasNoDueDate: e.target.checked })}
                        className="rounded text-[#8B72F4] focus:ring-[#8B72F4] w-3 h-3 cursor-pointer"
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
                    className={`w-full px-4 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-xs ${
                      taskForm.hasNoDueDate ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'cursor-pointer'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-[#8B72F4]" /> Daily Reminder
                  </label>
                  <select
                    disabled={taskForm.hasNoDueDate}
                    value={taskForm.reminderDaysBefore}
                    onChange={e => setTaskForm({ ...taskForm, reminderDaysBefore: parseInt(e.target.value, 10) })}
                    className={`w-full px-3 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 ${
                      taskForm.hasNoDueDate ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'cursor-pointer'
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

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-purple-100">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-purple-100 text-xs font-bold text-[#7A7289]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#8B72F4] to-[#A88BEB] text-white text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer"
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
          <div className="w-full max-w-md bg-[#FAF5F0] rounded-[32px] border-4 border-white shadow-2xl p-6 space-y-5 animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-pink-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#F472B6] text-white shadow-xs">
                  <Megaphone size={18} />
                </div>
                <h3 className="text-base font-black text-[#2D2638] font-display">
                  {editingAnn ? 'Edit Announcement' : 'Post Announcement'}
                </h3>
              </div>
              <button onClick={() => setIsAnnModalOpen(false)} className="p-1 rounded-xl text-[#7A7289] hover:bg-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2D2638] mb-1">Headline Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. District PSDS Alignment Meeting"
                  value={annForm.title}
                  onChange={e => setAnnForm({ ...annForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-pink-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#F472B6]/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D2638] mb-1">Content Body</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Write announcement details..."
                  value={annForm.content}
                  onChange={e => setAnnForm({ ...annForm, content: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-pink-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#F472B6]/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1">Tag</label>
                  <select
                    value={annForm.tag}
                    onChange={e => setAnnForm({ ...annForm, tag: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-2xl bg-white border border-pink-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#F472B6]/40"
                  >
                    <option value="Important">Important</option>
                    <option value="System Update">System Update</option>
                    <option value="Event">Event</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1">Author / Office</label>
                  <input
                    type="text"
                    value={annForm.author}
                    onChange={e => setAnnForm({ ...annForm, author: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-2xl bg-white border border-pink-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#F472B6]/40"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pin-check"
                  checked={annForm.isPinned}
                  onChange={e => setAnnForm({ ...annForm, isPinned: e.target.checked })}
                  className="rounded text-[#F472B6] focus:ring-[#F472B6]"
                />
                <label htmlFor="pin-check" className="text-xs font-bold text-[#2D2638] cursor-pointer flex items-center gap-1">
                  <Pin size={13} className="text-amber-600" /> Pin announcement to top of list
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-pink-100">
                <button
                  type="button"
                  onClick={() => setIsAnnModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-pink-100 text-xs font-bold text-[#7A7289]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#F472B6] to-[#F9A8D4] text-white text-xs font-black shadow-md hover:shadow-lg transition-all"
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
          <div className="w-full max-w-md bg-[#FAF5F0] rounded-[32px] border-4 border-white shadow-2xl p-6 space-y-5 animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-blue-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#3B82F6] text-white shadow-xs">
                  <CalendarDays size={18} />
                </div>
                <h3 className="text-base font-black text-[#2D2638] font-display">
                  {editingEvent ? 'Edit Scheduled Event' : 'Schedule New Event'}
                </h3>
              </div>
              <button onClick={() => setIsEventModalOpen(false)} className="p-1 rounded-xl text-[#7A7289] hover:bg-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2D2638] mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Faculty Development Seminar"
                  value={eventForm.title}
                  onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-blue-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#3B82F6]" /> Event Date
                  </label>
                  <input
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={e => setEventForm({ ...eventForm, date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-2xl bg-white border border-blue-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1">Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 09:00 AM - 12:00 PM"
                    value={eventForm.time}
                    onChange={e => setEventForm({ ...eventForm, time: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-2xl bg-white border border-blue-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1">Venue / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. District AVR"
                    value={eventForm.venue}
                    onChange={e => setEventForm({ ...eventForm, venue: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-2xl bg-white border border-blue-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1">Category</label>
                  <select
                    value={eventForm.category}
                    onChange={e => setEventForm({ ...eventForm, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-2xl bg-white border border-blue-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                  >
                    <option value="Meeting">Meeting</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Audit">Audit</option>
                    <option value="Conference">Conference</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D2638] mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional event info or instructions..."
                  value={eventForm.description}
                  onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-blue-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-blue-100">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-blue-100 text-xs font-bold text-[#7A7289]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white text-xs font-black shadow-md hover:shadow-lg transition-all"
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
            <div className="w-full max-w-2xl bg-[#FAF5F0] rounded-[32px] border-4 border-white shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto animate-scale-up font-sans" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2.5 rounded-2xl bg-[#8B72F4] text-white shadow-xs shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-[#2D2638] font-display truncate">
                      Task Compliance & Completion Status
                    </h3>
                    <p className="text-[11px] text-[#7A7289] font-medium truncate">
                      {complianceTask.title} &bull; {complianceTask.scopeType.toUpperCase()} Scope
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsComplianceModalOpen(false)} className="p-1 rounded-xl text-[#7A7289] hover:bg-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* Progress Summary Card */}
              <div className="p-4 rounded-2xl bg-white border border-purple-100 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[#2D2638]">Compliance Rate:</span>
                    <span className="font-black text-[#8B72F4] text-sm">{pct}%</span>
                    <span className="text-[#7A7289] font-semibold">({doneCount} of {totalCount} Staff Completed)</span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#7A7289]">
                    Due Date: {formatDateForDisplay(complianceTask.dueDate)}
                  </div>
                </div>

                <div className="w-full h-3 bg-purple-50 rounded-full overflow-hidden border border-purple-100 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-[#8B72F4] to-[#A88BEB] rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Compliance Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#FAF5F0] p-1 rounded-2xl border border-white text-xs font-extrabold">
                <button
                  onClick={() => setComplianceFilterTab('all')}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                    complianceFilterTab === 'all' ? 'bg-white text-[#8B72F4] shadow-xs' : 'text-[#7A7289] hover:text-[#2D2638]'
                  }`}
                >
                  All Targeted Staff ({totalCount})
                </button>
                <button
                  onClick={() => setComplianceFilterTab('completed')}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                    complianceFilterTab === 'completed' ? 'bg-white text-emerald-600 shadow-xs' : 'text-[#7A7289] hover:text-[#2D2638]'
                  }`}
                >
                  Completed ({doneCount})
                </button>
                <button
                  onClick={() => setComplianceFilterTab('pending')}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                    complianceFilterTab === 'pending' ? 'bg-white text-amber-700 shadow-xs' : 'text-[#7A7289] hover:text-[#2D2638]'
                  }`}
                >
                  Pending ({totalCount - doneCount})
                </button>
              </div>

              {/* Targeted Staff Cards List */}
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {isLoadingCompliance ? (
                  <div className="text-center py-8 text-xs font-bold text-[#7A7289]">
                    Loading compliance details from Supabase...
                  </div>
                ) : displayedStaff.length === 0 ? (
                  <div className="text-center py-8 bg-white/60 rounded-2xl border border-dashed border-purple-200 text-xs font-bold text-[#7A7289]">
                    No staff members match this filter criteria
                  </div>
                ) : (
                  displayedStaff.map(st => {
                    const isDone = completedMap.has(st.id)
                    const school = schools.find(s => (st.assigned_school_ids || []).includes(s.id))

                    return (
                      <div
                        key={st.id}
                        className="p-3.5 rounded-2xl bg-white border border-purple-100 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={st.avatar_url || "/images/clay/avatar_girl.jpg"}
                            alt={st.full_name}
                            className="w-9 h-9 rounded-full object-cover border border-white shadow-xs shrink-0 bg-[#F6EFFF]"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-[#2D2638] truncate">{st.full_name}</h4>
                            <p className="text-[10px] text-[#7A7289] font-medium truncate">
                              {st.role.replace('_', ' ').toUpperCase()} {school ? `• ${school.name}` : ''}
                            </p>
                            <p className="text-[10px] text-[#A39BAF] truncate">{st.email}</p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                              <CheckSquare size={11} /> Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold">
                              <Clock size={11} /> Pending
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-purple-100">
                <button
                  type="button"
                  onClick={() => setIsComplianceModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#8B72F4] to-[#A88BEB] text-white text-xs font-black shadow-md cursor-pointer"
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
            className={`w-full max-w-lg bg-[#FAF5F0] rounded-[36px] border-4 border-white shadow-[0_25px_60px_-15px_rgba(139,114,244,0.25)] p-7 transition-all duration-300 ${
              isSettingsModalOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-5 border-b-2 border-purple-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8B72F4] to-[#A88BEB] text-white flex items-center justify-center border-2 border-white shadow-md">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#2D2638] font-display">Account Settings</h2>
                  <p className="text-xs text-[#7A7289] font-medium">Update profile details, email & password</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="w-9 h-9 rounded-2xl bg-white/80 border border-purple-100 text-[#7A7289] hover:text-[#2D2638] hover:bg-white flex items-center justify-center font-bold text-lg shadow-sm transition-all"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveAccountSettings} className="mt-6 space-y-4">
              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/80 border border-purple-100 shadow-2xs">
                <div className="relative">
                  <img
                    src={settingsAvatarUrl || admin?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'}
                    alt="Profile Avatar"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#8B72F4] shadow-sm"
                  />
                  <label
                    htmlFor="hub-avatar-upload"
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-xl bg-[#8B72F4] text-white flex items-center justify-center cursor-pointer shadow-md hover:bg-[#7856e0] transition-colors"
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
                  <h4 className="text-xs font-bold text-[#2D2638]">Profile Photo</h4>
                  <p className="text-[10px] text-[#7A7289] font-medium mt-0.5">Click icon to upload a custom image</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D2638] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-xs"
                  placeholder="e.g. Christian S. Tolentino"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D2638] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={settingsEmail}
                  onChange={(e) => setSettingsEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-xs"
                  placeholder="name@deped.gov.ph"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D2638] mb-1">
                  New Password <span className="text-[10px] text-[#A39BAF] font-normal">(Leave blank to keep unchanged)</span>
                </label>
                <div className="relative">
                  <input
                    type={settingsShowPassword ? 'text' : 'password'}
                    value={settingsPassword}
                    onChange={(e) => setSettingsPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-xs pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setSettingsShowPassword(!settingsShowPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A39BAF] hover:text-[#2D2638]"
                  >
                    {settingsShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-purple-100">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-bold text-[#7A7289] hover:bg-purple-50 transition-all shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#8B72F4] to-[#A88BEB] text-white text-xs font-bold shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
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
