import {
  FileSpreadsheet,
  GraduationCap,
  Users,
  ClipboardList,
  FileCheck,
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
    id: 'hris',
    name: 'Faculty & Staff Governance',
    shortName: 'Faculty & Staff',
    description: 'Personnel records, multi-school assignments, grade assignments & role scoping',
    category: 'Human Resources',
    icon: Users,
    route: '/portal/staff',
    enabled: true,
    badgeText: 'Active',
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
