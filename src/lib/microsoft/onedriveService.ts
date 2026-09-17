import type { CloudFileItem, CloudFileType } from '@/types'

const ONEDRIVE_STORAGE_KEY = 'schoolconnect_onedrive_files_v1'
const MS_TOKEN_KEY = 'schoolconnect_ms_access_token'

export function getMicrosoftAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(MS_TOKEN_KEY)
}

export function setMicrosoftAccessToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(MS_TOKEN_KEY, token)
}

export function clearMicrosoftAccessToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(MS_TOKEN_KEY)
}

export function isMicrosoftConnected(): boolean {
  return !!getMicrosoftAccessToken()
}

export function classifyFileType(filename: string, mimeType?: string): CloudFileType {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf' || mimeType?.includes('pdf')) return 'pdf'
  if (['doc', 'docx', 'rtf'].includes(ext) || mimeType?.includes('word')) return 'word'
  if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return 'excel'
  if (['ppt', 'pptx'].includes(ext) || mimeType?.includes('presentation')) return 'powerpoint'
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext) || mimeType?.startsWith('image/')) return 'image'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mimeType?.includes('zip') || mimeType?.includes('compressed')) return 'archive'
  return 'other'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// Fetch files from local storage cache + OneDrive Graph API (if connected)
export async function fetchOneDriveFiles(): Promise<CloudFileItem[]> {
  const local = getLocalStorageFiles()
  const token = getMicrosoftAccessToken()

  if (!token) {
    return local
  }

  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (!res.ok) {
      if (res.status === 401) {
        clearMicrosoftAccessToken()
      }
      return local
    }

    const json = await res.json()
    const graphFiles: CloudFileItem[] = (json.value || []).map((item: any) => ({
      id: item.id,
      oneDriveItemId: item.id,
      name: item.name,
      size: item.size || 0,
      mimeType: item.file?.mimeType || 'application/octet-stream',
      fileType: classifyFileType(item.name, item.file?.mimeType),
      downloadUrl: item['@microsoft.graph.downloadUrl'] || item.webUrl,
      webUrl: item.webUrl,
      uploadedAt: item.createdDateTime || new Date().toISOString(),
      updatedAt: item.lastModifiedDateTime || new Date().toISOString()
    }))

    // Merge graph files with local metadata
    const graphIds = new Set(graphFiles.map(f => f.id))
    const combined = [...graphFiles, ...local.filter(f => !graphIds.has(f.id))]
    saveAllToLocalStorage(combined)
    return combined
  } catch (err) {
    console.warn('Failed to fetch live OneDrive files, returning cached files:', err)
    return local
  }
}

// Upload a file to OneDrive Graph API (or fallback to local data storage)
export async function uploadFileToOneDrive(
  file: File,
  uploaderName?: string,
  notes?: string
): Promise<CloudFileItem> {
  const token = getMicrosoftAccessToken()
  const fileType = classifyFileType(file.name, file.type)

  if (token) {
    try {
      // Small file upload via Microsoft Graph PUT API
      const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/SchoolConnect_Docs/${encodeURIComponent(file.name)}:/content`
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      })

      if (res.ok) {
        const item = await res.json()
        const newItem: CloudFileItem = {
          id: item.id,
          oneDriveItemId: item.id,
          name: item.name,
          size: item.size || file.size,
          mimeType: item.file?.mimeType || file.type,
          fileType,
          downloadUrl: item['@microsoft.graph.downloadUrl'] || item.webUrl,
          webUrl: item.webUrl,
          uploadedBy: uploaderName,
          uploadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notes
        }
        saveFileToLocalStorage(newItem)
        return newItem
      }
    } catch (err) {
      console.warn('Graph API upload error, creating browser vault item:', err)
    }
  }

  // Local storage demo fallback mode
  const localUrl = URL.createObjectURL(file)
  const localItem: CloudFileItem = {
    id: 'cloud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    fileType,
    downloadUrl: localUrl,
    previewUrl: file.type.startsWith('image/') || file.type.includes('pdf') ? localUrl : undefined,
    uploadedBy: uploaderName || 'Current Admin',
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes
  }
  saveFileToLocalStorage(localItem)
  return localItem
}

export async function deleteOneDriveFile(fileId: string): Promise<void> {
  const token = getMicrosoftAccessToken()
  removeFileFromLocalStorage(fileId)

  if (token && !fileId.startsWith('cloud_')) {
    try {
      await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (e) {
      console.warn('Failed to delete file on OneDrive server:', e)
    }
  }
}

// Local Storage Helpers
function getLocalStorageFiles(): CloudFileItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ONEDRIVE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : getSampleInitialFiles()
  } catch {
    return getSampleInitialFiles()
  }
}

function saveFileToLocalStorage(item: CloudFileItem): void {
  if (typeof window === 'undefined') return
  try {
    const list = getLocalStorageFiles()
    const index = list.findIndex(f => f.id === item.id)
    if (index >= 0) {
      list[index] = item
    } else {
      list.unshift(item)
    }
    localStorage.setItem(ONEDRIVE_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.warn('Failed to save cloud file to localStorage:', e)
  }
}

function saveAllToLocalStorage(list: CloudFileItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ONEDRIVE_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.warn('Failed to save files to localStorage:', e)
  }
}

function removeFileFromLocalStorage(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const list = getLocalStorageFiles().filter(f => f.id !== id)
    localStorage.setItem(ONEDRIVE_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.warn('Failed to remove cloud file from localStorage:', e)
  }
}

function getSampleInitialFiles(): CloudFileItem[] {
  return [
    {
      id: 'cloud_sample_1',
      name: 'SY_2025-2026_Term1_Competency_Consolidation_Report.xlsx',
      size: 248500,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileType: 'excel',
      uploadedBy: 'Division Administrator',
      uploadedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      colorTheme: 'green',
      isPinned: true,
      notes: 'Consolidated DepEd quarterly assessment matrix for Division Schools'
    },
    {
      id: 'cloud_sample_2',
      name: 'SchoolConnect_DepEd_LIS_Integration_Guidelines.pdf',
      size: 1540000,
      mimeType: 'application/pdf',
      fileType: 'pdf',
      uploadedBy: 'AO II Office',
      uploadedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      colorTheme: 'blue',
      isPinned: true,
      notes: 'Official DepEd memoranda and standard operating procedures'
    },
    {
      id: 'cloud_sample_3',
      name: 'Faculty_Staff_Credential_Directory_2026.docx',
      size: 420000,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileType: 'word',
      uploadedBy: 'System Administrator',
      uploadedAt: new Date(Date.now() - 3600000 * 72).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 72).toISOString(),
      colorTheme: 'purple',
      notes: 'Teaching staff assignment details and plantilla records'
    }
  ]
}
