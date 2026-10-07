import { ReactNode } from 'react'
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  AlertTriangle,
  Scale,
  BookOpen,
  BarChart3,
  Settings,
  Users,
  FileSpreadsheet,
  CalendarCheck,
  GraduationCap,
  NotebookPen,
  Bell,
  KeyRound,
  FolderOpen,
  Sparkles,
  PartyPopper,
  UserX,
  Building2,
  Calendar,
  Bookmark,
  ShieldCheck,
  ScrollText,
  Award,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
  badge?: string
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

// 1. TERMCAT System
export const termcatNavGroups: NavGroup[] = [
  {
    title: 'TERMCAT Evaluation & Monitoring',
    items: [
      { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { to: '/admin/submissions', label: 'Submissions & Monitoring', icon: <FileText size={18} /> },
      { to: '/admin/consolidation', label: 'Data Consolidation', icon: <ClipboardList size={18} /> },
      { to: '/admin/learner-mismatch', label: 'Learner Mismatch Report', icon: <AlertTriangle size={18} /> },
      { to: '/admin/learner-consistency', label: 'Subject Consistency Tracker', icon: <Scale size={18} /> },
      { to: '/admin/competencies', label: 'Budget of Work (Competencies)', icon: <BookOpen size={18} /> },
      { to: '/admin/reports', label: 'Reports & Analytics', icon: <BarChart3 size={18} /> },
      { to: '/admin/settings', label: 'System Settings', icon: <Settings size={18} /> },
    ],
  },
]

// 2. Learner Information System (LIS)
export const lisNavGroups: NavGroup[] = [
  {
    title: 'Learner Information System',
    items: [
      { to: '/lis/directory', label: 'Master Directory', icon: <Users size={18} /> },
      { to: '/lis/sf1', label: 'SF1 School Register', icon: <FileSpreadsheet size={18} /> },
      { to: '/lis/sf2', label: 'SF2 Daily Attendance', icon: <CalendarCheck size={18} /> },
      { to: '/lis/enrollment', label: 'Enrollment Registry', icon: <GraduationCap size={18} /> },
      { to: '/lis/analytics', label: 'Analytics & Reports', icon: <BarChart3 size={18} /> },
    ],
  },
]

// 3. Personal Notes & Vault
export const notesNavGroups: NavGroup[] = [
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

// 4. Civil Service Form 48 (DTR Generator)
export const dtrNavGroups: NavGroup[] = [
  {
    title: 'DTR Generator System',
    items: [
      { to: '/dtr?tab=dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { to: '/dtr?tab=my_dtrs', label: 'My DTRs', icon: <FolderOpen size={18} /> },
      { to: '/dtr?tab=generate', label: 'Generate DTR', icon: <Sparkles size={18} /> },
      { to: '/dtr?tab=holidays', label: 'Holidays', icon: <PartyPopper size={18} /> },
      { to: '/dtr?tab=absences', label: 'Absences', icon: <UserX size={18} /> },
      { to: '/dtr?tab=leave', label: 'Leave', icon: <FileSpreadsheet size={18} /> },
      { to: '/dtr?tab=settings', label: 'Settings', icon: <Settings size={18} /> },
    ],
  },
]

// 5. Academic Structure & Master Data
export const academicMasterDataNavGroups: NavGroup[] = [
  {
    title: 'Academic Structure & Master Data',
    items: [
      { to: '/admin/schools', label: 'Schools Directory', icon: <Building2 size={18} /> },
      { to: '/admin/learning-areas', label: 'Learning Areas', icon: <BookOpen size={18} /> },
      { to: '/admin/school-years', label: 'School Years & Terms', icon: <Calendar size={18} /> },
      { to: '/admin/sections', label: 'School Sections', icon: <Bookmark size={18} /> },
    ],
  },
]

// 6. Platform Administration & Staff
export const platformAdminNavGroups: NavGroup[] = [
  {
    title: 'Platform Administration & Staff',
    items: [
      { to: '/portal/staff', label: 'Faculty & Staff', icon: <Users size={18} /> },
      { to: '/admin/administrators', label: 'Administrators', icon: <ShieldCheck size={18} /> },
      { to: '/admin/audit-logs', label: 'Audit Logs', icon: <ScrollText size={18} /> },
      { to: '/admin/system-settings', label: 'System Settings', icon: <Settings size={18} /> },
    ],
  },
]

// 7. e-Class Record & Grading Portal
export const gradingNavGroups: NavGroup[] = [
  {
    title: 'e-Class Record & Grading',
    items: [
      { to: '/grading/class-record', label: 'e-Class Record (ECR)', icon: <ClipboardList size={18} /> },
      { to: '/grading/summary', label: 'Master Sheet & Ranking', icon: <BarChart3 size={18} /> },
      { to: '/grading/sf9', label: 'SF9 Report Cards', icon: <FileSpreadsheet size={18} /> },
      { to: '/grading/sf5', label: 'SF5 Promotion Report', icon: <Award size={18} /> },
      { to: '/grading/settings', label: 'Grading Settings', icon: <Settings size={18} /> },
    ],
  },
]
