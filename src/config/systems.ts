import {
  FileSpreadsheet,
  GraduationCap,
  ClipboardList,
  FileCheck,
  NotebookPen,
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
    id: 'lis',
    name: 'Learner Information System (LIS)',
    shortName: 'Learner Info System',
    description: 'Student profiles, LRN registry, enrollment management, sectioning & automated DepEd SF1/SF2 records',
    category: 'Student Management',
    icon: GraduationCap,
    route: '/lis',
    enabled: true,
    badgeText: 'Active',
  },
  {
    id: 'grading',
    name: 'e-Class Record & Grading',
    shortName: 'Grading Portal',
    description: 'Quarterly grade computation, ECR consolidation, SF9 report cards & SF5 promotion records',
    category: 'Academic Records',
    icon: ClipboardList,
    route: '/grading',
    enabled: true,
    badgeText: 'Active',
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
