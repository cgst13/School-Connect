import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SchoolConnectLayout, type NavGroup } from '@/components/layouts/SchoolConnectLayout'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import {
  Cloud,
  Upload,
  Search,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Archive,
  File,
  Plus,
  X,
  ExternalLink,
  Download,
  Trash2,
  Sparkles,
  RefreshCw,
  LayoutGrid,
  List,
  Check,
  Info,
  ShieldCheck,
  FolderOpen
} from 'lucide-react'
import {
  fetchOneDriveFiles,
  uploadFileToOneDrive,
  deleteOneDriveFile,
  formatFileSize,
  isMicrosoftConnected,
  setMicrosoftAccessToken,
  clearMicrosoftAccessToken
} from '@/lib/microsoft/onedriveService'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type { CloudFileItem, CloudFileType } from '@/types'
import { format, parseISO } from 'date-fns'

const cloudNavGroups: NavGroup[] = [
  {
    title: 'Cloud Vault & Storage',
    items: [
      { to: '/cloud-vault', label: 'All Cloud Files', icon: <Cloud size={18} /> },
      { to: '/cloud-vault?type=pdf', label: 'PDF Documents', icon: <FileText size={18} /> },
      { to: '/cloud-vault?type=word', label: 'Word Documents', icon: <FileText size={18} /> },
      { to: '/cloud-vault?type=excel', label: 'Excel Spreadsheets', icon: <FileSpreadsheet size={18} /> },
      { to: '/cloud-vault?type=image', label: 'Images & Photos', icon: <ImageIcon size={18} /> },
      { to: '/cloud-vault?type=archive', label: 'Compressed Archives', icon: <Archive size={18} /> }
    ]
  }
]

export function OneDriveVaultPage() {
  const { admin } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [files, setFiles] = useState<CloudFileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | CloudFileType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // View mode state (grid vs list)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      return (localStorage.getItem('sc_cloud_files_view_mode') as 'grid' | 'list') || 'grid'
    } catch {
      return 'grid'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('sc_cloud_files_view_mode', viewMode)
    } catch {
      // ignore
    }
  }, [viewMode])

  useEffect(() => {
    const t = searchParams.get('type') as CloudFileType | null
    if (t && ['pdf', 'word', 'excel', 'powerpoint', 'image', 'archive', 'other'].includes(t)) {
      setActiveTab(t)
    } else {
      setActiveTab('all')
    }
  }, [searchParams])

  // Connection & Auth Modal State
  const [isConnected, setIsConnected] = useState(isMicrosoftConnected())
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const [tokenInput, setTokenInput] = useState('')

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadNotes, setUploadNotes] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  // Preview & Delete States
  const [previewFile, setPreviewFile] = useState<CloudFileItem | null>(null)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadFiles()
  }, [])

  async function loadFiles() {
    setLoading(true)
    try {
      const data = await fetchOneDriveFiles()
      setFiles(data)
    } catch (err) {
      console.error('Failed to load cloud files:', err)
      toast('Failed to load cloud documents.', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleConnectMicrosoft() {
    if (!tokenInput.trim()) {
      toast('Please enter a valid Microsoft access token or OAuth credential.', 'error')
      return
    }
    setMicrosoftAccessToken(tokenInput.trim())
    setIsConnected(true)
    setIsConnectModalOpen(false)
    toast('Connected to Microsoft OneDrive!', 'success')
    loadFiles()
  }

  function handleDisconnectMicrosoft() {
    clearMicrosoftAccessToken()
    setIsConnected(false)
    toast('Disconnected from Microsoft OneDrive.', 'info')
    loadFiles()
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile) {
      toast('Please select a file to upload.', 'error')
      return
    }

    setUploading(true)
    try {
      const uploaded = await uploadFileToOneDrive(selectedFile, admin?.full_name || 'Admin', uploadNotes)
      setFiles(prev => [uploaded, ...prev])
      toast(`"${selectedFile.name}" was uploaded successfully!`, 'success')
      setIsUploadModalOpen(false)
      setSelectedFile(null)
      setUploadNotes('')
    } catch (err) {
      console.error('Upload failed:', err)
      toast('Failed to upload file to cloud storage.', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingFileId) return
    setIsDeleting(true)
    try {
      const target = files.find(f => f.id === deletingFileId)
      await deleteOneDriveFile(deletingFileId)
      setFiles(prev => prev.filter(f => f.id !== deletingFileId))
      toast(`"${target?.name || 'File'}" was deleted.`, 'success')
    } catch (err) {
      console.error('Delete failed:', err)
      toast('Failed to delete cloud document.', 'error')
    } finally {
      setIsDeleting(false)
      setDeletingFileId(null)
    }
  }

  const filteredFiles = files.filter(file => {
    if (activeTab !== 'all' && file.fileType !== activeTab) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchesName = file.name.toLowerCase().includes(q)
      const matchesNotes = file.notes?.toLowerCase().includes(q) || false
      const matchesUploader = file.uploadedBy?.toLowerCase().includes(q) || false
      return matchesName || matchesNotes || matchesUploader
    }
    return true
  })

  function getFileIcon(type: CloudFileType) {
    switch (type) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-rose-500" />
      case 'word':
        return <FileText className="h-5 w-5 text-blue-500" />
      case 'excel':
        return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
      case 'powerpoint':
        return <FileCode className="h-5 w-5 text-amber-500" />
      case 'image':
        return <ImageIcon className="h-5 w-5 text-purple-500" />
      case 'archive':
        return <Archive className="h-5 w-5 text-indigo-500" />
      default:
        return <File className="h-5 w-5 text-slate-500" />
    }
  }

  function getFileBadgeStyle(type: CloudFileType) {
    switch (type) {
      case 'pdf':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'word':
        return 'bg-sky-50 text-sky-700 border-sky-200'
      case 'excel':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'powerpoint':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'image':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'archive':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200'
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  return (
    <SchoolConnectLayout
      activeAppId="onedrive-vault"
      systemTitle="OneDrive Cloud Vault & Document Manager"
      systemSubtitle="Upload, Organize & Retrieve Files directly from Microsoft OneDrive"
      navGroups={cloudNavGroups}
    >
      <div className="flex-1 h-full overflow-y-auto pr-1 space-y-6 pb-12 animate-fade-in">
        
        {/* Top Executive Header Card */}
        <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          {/* Ambient Pastel Glow Orbs */}
          <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-gradient-to-br from-[#E0F2FE]/60 to-[#BAE6FD]/30 blur-2xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-56 h-56 rounded-full bg-gradient-to-tr from-[#E9D5FF]/50 to-[#F3EFFF]/30 blur-2xl pointer-events-none" />

          <div className="space-y-2 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E0F2FE] text-[#0369A1] text-xs font-black border border-[#BAE6FD]">
              <Cloud className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>Microsoft OneDrive & Cloud Document Manager</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#2D2638] tracking-tight font-display">
              OneDrive Cloud Vault
            </h1>
            <p className="text-xs sm:text-sm text-[#7A7289] font-medium max-w-2xl leading-relaxed">
              Upload and retrieve PDF documents, Word reports, Excel spreadsheets, images, and archives with Microsoft OneDrive integration.
            </p>
          </div>

          <div className="flex items-center gap-3 relative z-10 shrink-0 flex-wrap sm:flex-nowrap">
            {isConnected ? (
              <button
                onClick={handleDisconnectMicrosoft}
                className="inline-flex items-center gap-2 py-3 px-5 rounded-full text-xs font-bold text-emerald-800 bg-[#ECFDF5] border border-[#A7F3D0] hover:bg-emerald-100 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Connected to OneDrive</span>
              </button>
            ) : (
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="inline-flex items-center gap-2 py-3 px-5 rounded-full text-xs font-bold text-sky-800 bg-[#F0F9FF] border border-[#BAE6FD] hover:bg-sky-100 transition-all cursor-pointer"
              >
                <Cloud className="w-4 h-4 text-sky-600" />
                <span>Connect Microsoft Account</span>
              </button>
            )}

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 py-3 px-6 rounded-full text-xs font-black text-white bg-gradient-to-r from-[#38BDF8] via-[#0284C7] to-[#0369A1] shadow-[0_10px_25px_rgba(2,132,199,0.3)] hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Upload className="w-4.5 h-4.5 stroke-[2.5]" />
              <span>Upload Document</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 sm:px-4 sm:py-3 rounded-[28px] border border-white shadow-xs">
          
          {/* Left Side: Search Input & Category Pills */}
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A39BAF]" />
              <input
                type="text"
                placeholder="Search filenames or notes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-full bg-[#FAF5F0] border border-white shadow-2xs text-xs font-bold text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-2 focus:ring-[#0284C7]/30 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A39BAF] hover:text-[#2D2638]">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto py-1">
              {[
                { id: 'all', label: 'All Files' },
                { id: 'pdf', label: 'PDFs' },
                { id: 'word', label: 'Word' },
                { id: 'excel', label: 'Excel' },
                { id: 'image', label: 'Images' },
                { id: 'archive', label: 'Archives' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-[#2D2638] text-white shadow-2xs'
                      : 'bg-[#FAF5F0] text-[#7A7289] hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Side: Refresh & View Mode Toggle */}
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            <button
              onClick={loadFiles}
              title="Refresh Files"
              className="p-2 rounded-full bg-white shadow-xs border border-white text-[#7A7289] hover:text-[#0284C7] transition-all cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="flex items-center p-1 bg-[#FAF5F0] border border-white rounded-full shadow-2xs">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-[#2D2638] text-white shadow-2xs' : 'text-[#7A7289] hover:text-[#2D2638]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="List View"
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-[#2D2638] text-white shadow-2xs' : 'text-[#7A7289] hover:text-[#2D2638]'
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Files Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <DepEdSpinner />
            <p className="mt-4 text-xs font-extrabold text-[#7A7289]">Loading cloud documents...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-xl rounded-[32px] border-2 border-white p-12 text-center shadow-xs space-y-4 my-6">
            <div className="w-16 h-16 rounded-3xl bg-[#F0F9FF] text-[#0284C7] border border-[#BAE6FD] flex items-center justify-center mx-auto shadow-xs">
              <Cloud className="h-8 w-8" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-black text-[#2D2638]">No cloud files found</h3>
              <p className="text-xs text-[#7A7289] font-medium leading-relaxed">
                {searchQuery ? `No files matched "${searchQuery}".` : 'Upload documents, PDFs, or spreadsheets to get started.'}
              </p>
            </div>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black text-white bg-gradient-to-r from-[#38BDF8] to-[#0284C7] shadow-md hover:scale-105 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Upload Document</span>
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' : 'flex flex-col gap-3.5'}>
            {filteredFiles.map(file => {
              const badgeStyle = getFileBadgeStyle(file.fileType)

              if (viewMode === 'list') {
                return (
                  <div
                    key={file.id}
                    className="group relative rounded-2xl border border-white bg-white p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left: Info */}
                    <div className="flex items-start md:items-center gap-3 min-w-0 flex-1">
                      <div className="p-3 rounded-xl bg-[#FAF5F0] border border-white shrink-0">
                        {getFileIcon(file.fileType)}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${badgeStyle}`}>
                            {file.fileType}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                        <h3 className="text-sm font-extrabold text-[#2D2638] truncate tracking-tight">
                          {file.name}
                        </h3>
                        {file.notes && (
                          <p className="text-xs text-[#7A7289] line-clamp-1 font-medium">
                            {file.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <span className="text-[11px] font-medium text-slate-400">
                        {file.uploadedAt ? format(parseISO(file.uploadedAt), 'MMM d, yyyy') : ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {file.downloadUrl && (
                          <a
                            href={file.downloadUrl}
                            download={file.name}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-xl bg-[#FAF5F0] hover:bg-[#0284C7] hover:text-white text-[#7A7289] transition-all cursor-pointer"
                            title="Download File"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        {file.webUrl && (
                          <a
                            href={file.webUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-xl bg-[#FAF5F0] hover:bg-[#8B72F4] hover:text-white text-[#7A7289] transition-all cursor-pointer"
                            title="Open in Office Online"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          onClick={() => setDeletingFileId(file.id)}
                          className="p-2 rounded-xl bg-[#FAF5F0] hover:bg-rose-500 hover:text-white text-[#7A7289] transition-all cursor-pointer"
                          title="Delete File"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={file.id}
                  className="group relative rounded-3xl border border-white bg-white p-6 shadow-2xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="p-3.5 rounded-2xl bg-[#FAF5F0] border border-white">
                        {getFileIcon(file.fileType)}
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider border ${badgeStyle}`}>
                        {file.fileType}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-[#2D2638] tracking-tight line-clamp-2 leading-snug">
                      {file.name}
                    </h3>

                    {file.notes && (
                      <p className="text-xs text-[#7A7289] font-medium leading-relaxed line-clamp-3 bg-[#FAF5F0]/70 p-3 rounded-2xl border border-white">
                        {file.notes}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-[#2D2638]">{formatFileSize(file.size)}</p>
                      <p className="text-[11px] font-medium text-slate-400">
                        {file.uploadedAt ? format(parseISO(file.uploadedAt), 'MMM d, h:mm a') : 'Recently'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {file.downloadUrl && (
                        <a
                          href={file.downloadUrl}
                          download={file.name}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-[#FAF5F0] hover:bg-[#0284C7] hover:text-white text-[#7A7289] transition-all cursor-pointer"
                          title="Download File"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {file.webUrl && (
                        <a
                          href={file.webUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-[#FAF5F0] hover:bg-[#8B72F4] hover:text-white text-[#7A7289] transition-all cursor-pointer"
                          title="Open in Office Online"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        onClick={() => setDeletingFileId(file.id)}
                        className="p-2 rounded-xl bg-[#FAF5F0] hover:bg-rose-500 hover:text-white text-[#7A7289] transition-all cursor-pointer"
                        title="Delete File"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>

      {/* Upload File Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[32px] border border-white shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD]">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#2D2638]">Upload Document</h3>
                    <p className="text-xs text-[#7A7289] font-medium">Upload PDF, Word, Excel, Images or Zip files to OneDrive</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                {/* Drag & Drop File Area */}
                <div
                  onDragOver={e => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault()
                    setIsDragging(false)
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setSelectedFile(e.dataTransfer.files[0])
                    }
                  }}
                  className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all cursor-pointer ${
                    isDragging ? 'border-[#0284C7] bg-[#F0F9FF]' : 'border-slate-200 bg-[#FAF5F0] hover:border-[#0284C7]/50'
                  }`}
                  onClick={() => document.getElementById('cloud-file-input')?.click()}
                >
                  <input
                    id="cloud-file-input"
                    type="file"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0])
                      }
                    }}
                  />
                  <Cloud className="h-10 w-10 text-[#0284C7] mx-auto mb-2" />
                  {selectedFile ? (
                    <div className="space-y-1">
                      <p className="text-xs font-black text-[#2D2638] truncate">{selectedFile.name}</p>
                      <p className="text-[11px] font-bold text-slate-400">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-black text-[#2D2638]">Click to upload or drag & drop</p>
                      <p className="text-[11px] text-[#7A7289]">PDF, DOCX, XLSX, PPTX, PNG, JPG, ZIP (Max 50MB)</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1.5">
                    File Notes / Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Add brief memo or reference details about this file..."
                    value={uploadNotes}
                    onChange={e => setUploadNotes(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-[#FAF5F0] border border-white shadow-2xs text-xs font-medium text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-2 focus:ring-[#0284C7]/30"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !selectedFile}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black text-white bg-gradient-to-r from-[#38BDF8] to-[#0284C7] shadow-md hover:scale-105 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span>{uploading ? 'Uploading...' : 'Confirm Upload'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Connect Microsoft OAuth / Token Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[32px] border border-white shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-[#F0F9FF] text-[#0284C7] border border-[#BAE6FD]">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#2D2638]">Connect Microsoft OneDrive</h3>
                    <p className="text-xs text-[#7A7289]">Enter Microsoft Graph Access Token</p>
                  </div>
                </div>
                <button onClick={() => setIsConnectModalOpen(false)} className="p-2 rounded-full text-slate-400 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF5F0] border border-white text-xs text-[#7A7289] space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-[#2D2638]">
                  <Info className="h-4 w-4 text-[#0284C7]" />
                  <span>Azure AD Application Credential Setup</span>
                </div>
                <p>
                  To sync with live Microsoft OneDrive files, paste your Microsoft Graph API Bearer Token from Azure Portal / Entra ID.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D2638] mb-1.5">
                  Microsoft Graph Access Token / Secret
                </label>
                <textarea
                  rows={4}
                  placeholder="Paste OAuth Access Token (E.g. eyJ0eXAiOiJKV1Qi...)"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-[#FAF5F0] border border-white shadow-2xs text-xs font-mono text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-2 focus:ring-[#0284C7]/30"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnectMicrosoft}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black text-white bg-gradient-to-r from-[#38BDF8] to-[#0284C7] shadow-md hover:scale-105 transition-all cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Save Connection</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!deletingFileId}
        title="Delete Cloud File"
        message="Are you sure you want to delete this document from OneDrive cloud storage?"
        confirmLabel="Delete Document"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingFileId(null)}
      />
    </SchoolConnectLayout>
  )
}
