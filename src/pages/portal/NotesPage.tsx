import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { SchoolConnectLayout, type NavGroup } from '@/components/layouts/SchoolConnectLayout'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import {
  NotebookPen,
  Plus,
  Search,
  Pin,
  Calendar,
  KeyRound,
  FileText,
  Eye,
  EyeOff,
  Copy,
  Check,
  Edit2,
  Trash2,
  X,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Bell,
  RefreshCw,
  Clock,
  LayoutGrid,
  List
} from 'lucide-react'
import {
  fetchUserNotes,
  createUserNote,
  updateUserNote,
  deleteUserNote,
  insertAuditLog
} from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { formatDetailedError } from '@/utils/formatError'
import type { UserNote, NoteCategory, NoteColorTheme } from '@/types'
import { format, isPast, parseISO } from 'date-fns'

const notesNavGroups: NavGroup[] = [
  {
    title: 'Personal Utilities & Storage',
    items: [
      { to: '/notes', label: 'All Notes & Vault', icon: <NotebookPen size={18} /> },
      { to: '/notes?category=note', label: 'Personal Notes', icon: <FileText size={18} /> },
      { to: '/notes?category=reminder', label: 'Reminders & Tasks', icon: <Bell size={18} /> },
      { to: '/notes?category=credential', label: 'Credentials Vault', icon: <KeyRound size={18} /> },
    ],
  },
]

const COLOR_THEMES: { id: NoteColorTheme; label: string; bgClass: string; borderClass: string; badgeClass: string; textClass: string }[] = [
  {
    id: 'yellow',
    label: 'Soft Cream',
    bgClass: 'bg-[#FEFCE8]',
    borderClass: 'border-[#FEF08A] hover:border-[#FDE047]',
    badgeClass: 'bg-[#FEF08A]/70 text-[#854D0E] border-[#FDE047]',
    textClass: 'text-[#713F12]'
  },
  {
    id: 'blue',
    label: 'Soft Blue',
    bgClass: 'bg-[#F0F9FF]',
    borderClass: 'border-[#BAE6FD] hover:border-[#7DD3FC]',
    badgeClass: 'bg-[#E0F2FE] text-[#0369A1] border-[#7DD3FC]',
    textClass: 'text-[#075985]'
  },
  {
    id: 'green',
    label: 'Soft Mint',
    bgClass: 'bg-[#ECFDF5]',
    borderClass: 'border-[#A7F3D0] hover:border-[#6EE7B7]',
    badgeClass: 'bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]',
    textClass: 'text-[#064E3B]'
  },
  {
    id: 'purple',
    label: 'Soft Lavender',
    bgClass: 'bg-[#F5F0FF]',
    borderClass: 'border-[#E9D5FF] hover:border-[#DDD6FE]',
    badgeClass: 'bg-[#F3EFFF] text-[#6D28D9] border-[#DDD6FE]',
    textClass: 'text-[#5B21B6]'
  },
  {
    id: 'rose',
    label: 'Soft Rose',
    bgClass: 'bg-[#FFF0F5]',
    borderClass: 'border-[#F7C7D9] hover:border-[#FDA4AF]',
    badgeClass: 'bg-[#FFE4E6] text-[#9F1239] border-[#FDA4AF]',
    textClass: 'text-[#881337]'
  },
  {
    id: 'slate',
    label: 'Soft Slate',
    bgClass: 'bg-[#F8FAFC]',
    borderClass: 'border-[#E2E8F0] hover:border-[#CBD5E1]',
    badgeClass: 'bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]',
    textClass: 'text-[#1E293B]'
  }
]

export function NotesPage() {
  const { admin } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [notes, setNotes] = useState<UserNote[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | NoteCategory>('all')

  useEffect(() => {
    const cat = searchParams.get('category') || searchParams.get('type')
    if (cat === 'note' || cat === 'reminder' || cat === 'credential') {
      setActiveTab(cat)
    } else {
      setActiveTab('all')
    }
  }, [searchParams])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedColorFilter, setSelectedColorFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      return (localStorage.getItem('sc_notes_view_mode') as 'grid' | 'list') || 'grid'
    } catch {
      return 'grid'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('sc_notes_view_mode', viewMode)
    } catch {
      // ignore
    }
  }, [viewMode])

  // Password visibility map (for credential notes)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<UserNote | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form Fields
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'note' as NoteCategory,
    colorTheme: 'yellow' as NoteColorTheme,
    isPinned: false,
    reminderDate: '',
    systemName: '',
    accountUsername: '',
    accountPassword: '',
    targetUrl: ''
  })

  // Delete State
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadNotes()
  }, [admin?.id])

  async function loadNotes() {
    if (!admin?.id) return
    setLoading(true)
    try {
      const data = await fetchUserNotes(admin.id)
      setNotes(data)
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to retrieve your notes', table: 'sc_portal_user_notes' }), 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenModal(noteToEdit?: UserNote) {
    if (noteToEdit) {
      setEditingNote(noteToEdit)
      setFormData({
        title: noteToEdit.title,
        content: noteToEdit.content || '',
        category: noteToEdit.category,
        colorTheme: noteToEdit.colorTheme || 'yellow',
        isPinned: noteToEdit.isPinned || false,
        reminderDate: noteToEdit.reminderDate ? new Date(noteToEdit.reminderDate).toISOString().slice(0, 16) : '',
        systemName: noteToEdit.systemName || '',
        accountUsername: noteToEdit.accountUsername || '',
        accountPassword: noteToEdit.accountPassword || '',
        targetUrl: noteToEdit.targetUrl || ''
      })
    } else {
      setEditingNote(null)
      setFormData({
        title: '',
        content: '',
        category: activeTab === 'all' ? 'note' : activeTab,
        colorTheme: 'yellow',
        isPinned: false,
        reminderDate: '',
        systemName: '',
        accountUsername: '',
        accountPassword: '',
        targetUrl: ''
      })
    }
    setIsModalOpen(true)
  }

  async function handleSaveNote(e: React.FormEvent) {
    e.preventDefault()
    if (!admin?.id) return
    if (!formData.title.trim()) {
      toast('Please enter a title for your note or vault entry.', 'error')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        userId: admin.id,
        title: formData.title.trim(),
        content: formData.content.trim() || undefined,
        category: formData.category,
        colorTheme: formData.colorTheme,
        isPinned: formData.isPinned,
        reminderDate: formData.reminderDate ? new Date(formData.reminderDate).toISOString() : undefined,
        systemName: formData.category === 'credential' ? formData.systemName.trim() || undefined : undefined,
        accountUsername: formData.category === 'credential' ? formData.accountUsername.trim() || undefined : undefined,
        accountPassword: formData.category === 'credential' ? formData.accountPassword || undefined : undefined,
        targetUrl: formData.category === 'credential' ? formData.targetUrl.trim() || undefined : undefined
      }

      if (editingNote) {
        await updateUserNote(editingNote.id, payload, admin.id)
        toast(`"${formData.title}" was updated successfully.`, 'success')
        await insertAuditLog({
          admin_id: admin.id,
          admin_name: admin.full_name || admin.email || 'User',
          action: 'update_note',
          entity_type: 'note',
          entity_label: formData.title
        })
      } else {
        await createUserNote(payload)
        toast(`"${formData.title}" was saved.`, 'success')
        await insertAuditLog({
          admin_id: admin.id,
          admin_name: admin.full_name || admin.email || 'User',
          action: 'create_note',
          entity_type: 'note',
          entity_label: formData.title
        })
      }

      setIsModalOpen(false)
      loadNotes()
    } catch (err: any) {
      toast(formatDetailedError(err, { action: 'Failed to save note to Supabase', table: 'sc_portal_user_notes' }), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTogglePin(note: UserNote) {
    try {
      const updatedPinnedState = !note.isPinned
      await updateUserNote(note.id, { isPinned: updatedPinnedState }, admin?.id)
      setNotes(prev =>
        prev.map(n => (n.id === note.id ? { ...n, isPinned: updatedPinnedState } : n))
      )
      toast(`"${note.title}" ${updatedPinnedState ? 'pinned to top' : 'unpinned from top'}.`, 'success')
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to update pin state in Supabase', table: 'sc_portal_user_notes' }), 'error')
    }
  }

  async function handleDeleteNote() {
    if (!deletingNoteId || !admin?.id) return
    setIsDeleting(true)
    try {
      const targetNote = notes.find(n => n.id === deletingNoteId)
      await deleteUserNote(deletingNoteId, admin.id)
      setNotes(prev => prev.filter(n => n.id !== deletingNoteId))
      toast('The note has been deleted.', 'success')
      if (targetNote) {
        await insertAuditLog({
          admin_id: admin.id,
          admin_name: admin.full_name || admin.email || 'User',
          action: 'delete_note',
          entity_type: 'note',
          entity_label: targetNote.title
        })
      }
    } catch (err: any) {
      toast(formatDetailedError(err, { action: 'Failed to delete note from Supabase', table: 'sc_portal_user_notes' }), 'error')
    } finally {
      setIsDeleting(false)
      setDeletingNoteId(null)
    }
  }

  function handleCopyText(text: string, fieldId: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    toast('Copied to clipboard!', 'info')
    setTimeout(() => {
      setCopiedField(null)
    }, 2000)
  }

  function generateRandomPassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let pass = ''
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, accountPassword: pass }))
  }

  // Filtered Notes Computation
  const filteredNotes = notes
    .filter(note => {
      if (activeTab !== 'all' && note.category !== activeTab) return false
      if (selectedColorFilter !== 'all' && note.colorTheme !== selectedColorFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = note.title.toLowerCase().includes(q)
        const matchesContent = note.content?.toLowerCase().includes(q) || false
        const matchesSystem = note.systemName?.toLowerCase().includes(q) || false
        const matchesUsername = note.accountUsername?.toLowerCase().includes(q) || false
        return matchesTitle || matchesContent || matchesSystem || matchesUsername
      }
      return true
    })
    .sort((a, b) => {
      // Pinned notes first
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return timeB - timeA
    })

  // Count summaries
  const noteCounts = {
    all: notes.length,
    note: notes.filter(n => n.category === 'note').length,
    reminder: notes.filter(n => n.category === 'reminder').length,
    credential: notes.filter(n => n.category === 'credential').length
  }

  return (
    <SchoolConnectLayout
      activeAppId="notes"
      systemTitle="Personal Notes & Credentials Vault"
      systemSubtitle="Secure Notes, Password Management & Access Reminders"
      navGroups={notesNavGroups}
    >
      <div className="flex-1 h-full overflow-y-auto pr-1 space-y-6 pb-12 animate-fade-in">
        
        {/* Top Header Card */}
        <PageHeader
          badge="Personal Utilities & Vault"
          title="Personal Notes & Credentials Vault"
          description="Keep quick notes, track upcoming reminders, and securely store your credentials for social media apps and school systems."
          actions={
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 py-2.5 px-5 rounded-full text-xs font-black text-white bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Note / Credentials</span>
            </button>
          }
        />

        {/* Search & Color Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 sm:px-4 sm:py-3 rounded-[28px] border border-white shadow-xs">

          {/* Left Side: Search & Color Filter Dots */}
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A39BAF]" />
              <input
                type="text"
                placeholder="Search notes or logins..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-full bg-[#FAF5F0] border border-white shadow-2xs text-xs font-bold text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A39BAF] hover:text-[#2D2638]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Color Filter Dots */}
            <div className="flex items-center gap-1.5 p-1.5 bg-[#FAF5F0] border border-white rounded-full shadow-2xs">
              <button
                onClick={() => setSelectedColorFilter('all')}
                title="All Colors"
                className={`w-6 h-6 rounded-full text-[9px] font-black flex items-center justify-center transition-all cursor-pointer ${
                  selectedColorFilter === 'all'
                    ? 'bg-[#2D2638] text-white shadow-2xs'
                    : 'text-[#7A7289] hover:bg-white'
                }`}
              >
                All
              </button>
              {COLOR_THEMES.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedColorFilter(theme.id)}
                  title={theme.label}
                  className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                    selectedColorFilter === theme.id ? 'scale-125 ring-2 ring-[#8B72F4] ring-offset-1' : 'hover:scale-110 opacity-75 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor:
                      theme.id === 'yellow' ? '#f59e0b' :
                      theme.id === 'blue' ? '#0284c7' :
                      theme.id === 'green' ? '#10b981' :
                      theme.id === 'purple' ? '#8b72f4' :
                      theme.id === 'rose' ? '#f43f5e' : '#64748b'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Right Side: Refresh & View Mode Toggle (Grid vs List) */}
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            <button
              onClick={loadNotes}
              title="Refresh Items"
              className="p-2 rounded-full bg-white shadow-xs border border-white text-[#7A7289] hover:text-[#8B72F4] transition-all cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="flex items-center p-1 bg-[#FAF5F0] border border-white rounded-full shadow-2xs">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#2D2638] text-white shadow-2xs'
                    : 'text-[#7A7289] hover:text-[#2D2638]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="List View"
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#2D2638] text-white shadow-2xs'
                    : 'text-[#7A7289] hover:text-[#2D2638]'
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Cards Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <DepEdSpinner />
            <p className="mt-4 text-xs font-extrabold text-[#7A7289]">Loading your notes & credentials vault...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-xl rounded-[32px] border-2 border-white p-12 text-center shadow-xs space-y-4 my-6">
            <div className="w-16 h-16 rounded-3xl bg-[#F5F0FF] text-[#8B72F4] border border-[#E9D5FF] flex items-center justify-center mx-auto shadow-xs">
              <NotebookPen className="h-8 w-8" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-black text-[#2D2638]">No items found</h3>
              <p className="text-xs text-[#7A7289] font-medium leading-relaxed">
                {searchQuery
                  ? `No items matched "${searchQuery}". Try clearing your search keyword.`
                  : 'You haven\'t added any notes, reminders, or passwords in this category yet.'}
              </p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black text-white bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] shadow-md hover:scale-105 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Item</span>
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' : 'flex flex-col gap-3.5'}>
            {filteredNotes.map(note => {
              const theme = COLOR_THEMES.find(t => t.id === (note.colorTheme || 'yellow')) || COLOR_THEMES[0]
              const isCredential = note.category === 'credential'
              const isReminder = note.category === 'reminder'
              const isPasswordVisible = visiblePasswords[note.id] || false

              const isReminderOverdue =
                isReminder && note.reminderDate && isPast(parseISO(note.reminderDate))

              if (viewMode === 'list') {
                return (
                  <div
                    key={note.id}
                    className={`group relative rounded-2xl border ${theme.borderClass} ${theme.bgClass} p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4`}
                  >
                    {/* Left Side: Category, Badges, Title, Snippet & Credential inline info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${theme.badgeClass}`}>
                          {isCredential ? (
                            <KeyRound className="h-3 w-3" />
                          ) : isReminder ? (
                            <Bell className="h-3 w-3" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          <span className="capitalize">{note.category}</span>
                        </span>

                        {isReminder && note.reminderDate && (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${
                              isReminderOverdue
                                ? 'bg-red-500/10 text-red-600 border-red-300'
                                : 'bg-sky-500/10 text-sky-600 border-sky-300'
                            }`}
                          >
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(note.reminderDate), 'MMM d, h:mm a')}
                          </span>
                        )}

                        {note.isPinned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500 text-white shadow-2xs">
                            <Pin className="h-2.5 w-2.5 fill-white rotate-45" /> Pinned
                          </span>
                        )}
                      </div>

                      <h3 className={`text-base font-extrabold ${theme.textClass} tracking-tight truncate`}>
                        {note.title}
                      </h3>

                      {isCredential && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 font-medium pt-1">
                          {note.systemName && (
                            <div>App: <span className="font-bold text-slate-800">{note.systemName}</span></div>
                          )}
                          {note.accountUsername && (
                            <div className="flex items-center gap-1">
                              Username: <span className="font-bold text-slate-800 font-mono">{note.accountUsername}</span>
                              <button
                                onClick={() => handleCopyText(note.accountUsername!, `user-${note.id}`)}
                                className="p-0.5 text-slate-400 hover:text-slate-700"
                              >
                                {copiedField === `user-${note.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          )}
                          {note.accountPassword && (
                            <div className="flex items-center gap-1">
                              Password: <span className="font-bold text-slate-800 font-mono">{isPasswordVisible ? note.accountPassword : '••••••••••••'}</span>
                              <button
                                onClick={() => setVisiblePasswords(prev => ({ ...prev, [note.id]: !isPasswordVisible }))}
                                className="p-0.5 text-slate-400 hover:text-slate-700"
                              >
                                {isPasswordVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                              <button
                                onClick={() => handleCopyText(note.accountPassword!, `pass-${note.id}`)}
                                className="p-0.5 text-slate-400 hover:text-slate-700"
                              >
                                {copiedField === `pass-${note.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          )}
                          {note.targetUrl && (
                            <a
                              href={note.targetUrl.startsWith('http') ? note.targetUrl : `https://${note.targetUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-amber-600 hover:underline font-bold"
                            >
                              <span>Launch</span> <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}

                      {note.content && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-normal">
                          {note.content}
                        </p>
                      )}
                    </div>

                    {/* Right Side: Meta & Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/50">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {note.updatedAt ? format(parseISO(note.updatedAt), 'MMM d, h:mm a') : ''}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTogglePin(note)}
                          title={note.isPinned ? 'Unpin' : 'Pin to top'}
                          className={`p-1.5 rounded-xl transition-colors ${
                            note.isPinned ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-400 hover:text-slate-700 hover:bg-black/5'
                          }`}
                        >
                          <Pin className={`h-3.5 w-3.5 ${note.isPinned ? 'fill-white rotate-45' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleOpenModal(note)}
                          title="Edit Note"
                          className="p-1.5 rounded-xl hover:bg-slate-200/60 text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingNoteId(note.id)}
                          title="Delete Note"
                          className="p-1.5 rounded-xl hover:bg-rose-100 text-slate-500 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={note.id}
                  className={`group relative rounded-3xl border ${theme.borderClass} ${theme.bgClass} p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between`}
                >
                  {/* Note Top Bar */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Category Badge */}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${theme.badgeClass}`}>
                          {isCredential ? (
                            <KeyRound className="h-3.5 w-3.5" />
                          ) : isReminder ? (
                            <Bell className="h-3.5 w-3.5" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                          <span className="capitalize">{note.category}</span>
                        </span>

                        {/* Reminder Badge */}
                        {isReminder && note.reminderDate && (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                              isReminderOverdue
                                ? 'bg-red-500/10 text-red-600 border-red-300 dark:border-red-800'
                                : 'bg-sky-500/10 text-sky-600 border-sky-300 dark:border-sky-800'
                            }`}
                          >
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(note.reminderDate), 'MMM d, h:mm a')}
                          </span>
                        )}
                      </div>

                      {/* Pin Toggle Button */}
                      <button
                        onClick={() => handleTogglePin(note)}
                        title={note.isPinned ? 'Unpin' : 'Pin to top'}
                        className={`p-1.5 rounded-xl transition-colors ${
                          note.isPinned
                            ? 'bg-amber-500 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <Pin className={`h-4 w-4 ${note.isPinned ? 'fill-white rotate-45' : ''}`} />
                      </button>
                    </div>

                    {/* Note Title */}
                    <h3 className={`text-lg font-extrabold ${theme.textClass} tracking-tight mb-2 line-clamp-2`}>
                      {note.title}
                    </h3>

                    {/* Credential Details (If Credential Category) */}
                    {isCredential && (
                      <div className="my-3 space-y-2 p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 text-xs">
                        {note.systemName && (
                          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                            <span className="font-medium">App / System:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{note.systemName}</span>
                          </div>
                        )}

                        {note.accountUsername && (
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Username/Email:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono select-all">
                                {note.accountUsername}
                              </span>
                              <button
                                onClick={() => handleCopyText(note.accountUsername!, `user-${note.id}`)}
                                title="Copy username"
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              >
                                {copiedField === `user-${note.id}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {note.accountPassword && (
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Password:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                                {isPasswordVisible ? note.accountPassword : '••••••••••••'}
                              </span>
                              <button
                                onClick={() =>
                                  setVisiblePasswords(prev => ({ ...prev, [note.id]: !isPasswordVisible }))
                                }
                                title={isPasswordVisible ? 'Hide password' : 'Show password'}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              >
                                {isPasswordVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={() => handleCopyText(note.accountPassword!, `pass-${note.id}`)}
                                title="Copy password"
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              >
                                {copiedField === `pass-${note.id}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {note.targetUrl && (
                          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                            <a
                              href={note.targetUrl.startsWith('http') ? note.targetUrl : `https://${note.targetUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline font-medium"
                            >
                              <span>Launch URL</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Note Content */}
                    {note.content && (
                      <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap line-clamp-5 leading-relaxed font-normal mb-4">
                        {note.content}
                      </p>
                    )}
                  </div>

                  {/* Note Footer & Actions */}
                  <div className="pt-3 mt-2 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Updated {note.updatedAt ? format(parseISO(note.updatedAt), 'MMM d, h:mm a') : 'Recently'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenModal(note)}
                        title="Edit Note"
                        className="p-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingNoteId(note.id)}
                        title="Delete Note"
                        className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Note Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
                  <NotebookPen className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {editingNote ? 'Edit Item' : 'New Note or Vault Entry'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Save personal notes, reminders, or secure credentials.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveNote} className="space-y-4">
              {/* Category selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: 'note' }))}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border text-xs font-bold transition-all ${
                      formData.category === 'note'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    <span>Note</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: 'reminder' }))}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border text-xs font-bold transition-all ${
                      formData.category === 'reminder'
                        ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <Bell className="h-4 w-4" />
                    <span>Reminder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: 'credential' }))}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border text-xs font-bold transition-all ${
                      formData.category === 'credential'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>Credential Vault</span>
                  </button>
                </div>
              </div>

              {/* Title Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Title / Subject <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    formData.category === 'credential'
                      ? 'e.g. DepEd LIS Account / Facebook'
                      : formData.category === 'reminder'
                      ? 'e.g. Submit Form 137 to Division'
                      : 'e.g. Meeting Key Takeaways'
                  }
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Credential Specific Fields */}
              {formData.category === 'credential' && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span>Vault Account Credentials</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        System / App Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. DepEd Enterprise Portal"
                        value={formData.systemName}
                        onChange={e => setFormData(prev => ({ ...prev, systemName: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Username / Email
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. juan.delacruz@deped.gov.ph"
                        value={formData.accountUsername}
                        onChange={e => setFormData(prev => ({ ...prev, accountUsername: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Generate Random</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter password..."
                      value={formData.accountPassword}
                      onChange={e => setFormData(prev => ({ ...prev, accountPassword: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Login URL (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. https://lis.deped.gov.ph"
                      value={formData.targetUrl}
                      onChange={e => setFormData(prev => ({ ...prev, targetUrl: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}

              {/* Reminder Date/Time Field */}
              {formData.category === 'reminder' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Reminder Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.reminderDate}
                    onChange={e => setFormData(prev => ({ ...prev, reminderDate: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Content / Notes Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Content / Details
                </label>
                <textarea
                  rows={4}
                  placeholder="Write details, bullet points, or notes..."
                  value={formData.content}
                  onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Color Theme Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Card Color Theme
                </label>
                <div className="flex items-center gap-3">
                  {COLOR_THEMES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, colorTheme: t.id }))}
                      className={`h-8 w-8 rounded-2xl flex items-center justify-center transition-all ${
                        formData.colorTheme === t.id ? 'ring-2 ring-amber-500 ring-offset-2 scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor:
                          t.id === 'yellow' ? '#f59e0b' :
                          t.id === 'blue' ? '#0284c7' :
                          t.id === 'green' ? '#10b981' :
                          t.id === 'purple' ? '#a855f7' :
                          t.id === 'rose' ? '#f43f5e' : '#64748b'
                      }}
                    >
                      {formData.colorTheme === t.id && <Check className="h-4 w-4 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pin Checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="pinCheckbox"
                  checked={formData.isPinned}
                  onChange={e => setFormData(prev => ({ ...prev, isPinned: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="pinCheckbox" className="text-xs font-semibold text-slate-700 dark:text-slate-300 select-none">
                  Pin this item to top of list
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-500/30 hover:bg-amber-600 disabled:opacity-50"
                >
                  {isSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingNote ? 'Save Changes' : 'Create Item'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!deletingNoteId}
        onCancel={() => setDeletingNoteId(null)}
        onConfirm={handleDeleteNote}
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmLabel="Delete Item"
        variant="danger"
        isLoading={isDeleting}
      />
    </SchoolConnectLayout>
  )
}
