import {
  FileSpreadsheet,
  GraduationCap,
  ClipboardList,
  FileCheck,
  NotebookPen,
  Cloud,
  Clock,
  LucideIcon
} from 'lucide-react'

export interface SystemConfig {
  id: string
  name: string
  shortName: string
  description: string
  category: string
  icon: LucideIcon
  route: string
  enabled: boolean
  badgeText?: string
}

export const REGISTERED_SYSTEMS: SystemConfig[] = [
  {
    id: 'termcat',
    name: 'TERMCAT System',
    shortName: 'TERMCAT',
    description: 'Teacher Evaluation & Record Monitoring Category System',
    category: 'Evaluation & Monitoring',
    icon: FileCheck,
    route: '/admin',
    enabled: true,
    badgeText: 'Active',
  },
  {
    id: 'notes',
    name: 'Personal Notes & Vault',
    shortName: 'Notes & Vault',
    description: 'Create notes, set reminders, and securely store credentials & passwords',
    category: 'Productivity & Utilities',
    icon: NotebookPen,
    route: '/notes',
    enabled: true,
    badgeText: 'Active',
  },
  {
    id: 'onedrive-vault',
    name: 'OneDrive Cloud Vault',
    shortName: 'Cloud Vault',
    description: 'Upload, manage, and retrieve PDF, Word, Excel & media files via Microsoft OneDrive',
    category: 'Cloud Storage & Documents',
    icon: Cloud,
    route: '/cloud-vault',
    enabled: true,
    badgeText: 'Active',
  },
  {
    id: 'dtr-generator',
    name: 'Civil Service Form 48 (DTR Generator)',
    shortName: 'DTR Generator',
    description: 'Generate, customize, and print CS Form 48 Daily Time Records with non-late time generator & 2-in-1 layout',
    category: 'Compliance & Attendance',
    icon: Clock,
    route: '/dtr',
    enabled: true,
    badgeText: 'Active',
  },
  {
    id: 'sis',
    name: 'Learner Info System (SIS)',
    shortName: 'SIS',
    description: 'Student profiles, enrollment, sectioning & attendance tracking',
    category: 'Student Management',
    icon: GraduationCap,
    route: '/sis',
    enabled: false,
    badgeText: 'Coming Soon',
  },
  {
    id: 'grading',
    name: 'e-Class Record & Grading',
    shortName: 'Grading Portal',
    description: 'Quarterly grade computation, consolidation & report cards',
    category: 'Academic Records',
    icon: ClipboardList,
    route: '/grading',
    enabled: false,
    badgeText: 'Coming Soon',
  },
  {
    id: 'deped_forms',
    name: 'DepEd Automated Forms Engine',
    shortName: 'DepEd Forms Engine',
    description: 'Auto-generation of SF1, SF2, SF5, SF10 & Form 137 records',
    category: 'Compliance & Reports',
    icon: FileSpreadsheet,
    route: '/forms',
    enabled: false,
    badgeText: 'Coming Soon',
  },
]
