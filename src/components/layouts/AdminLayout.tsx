import { useState, ReactNode } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FileText, BarChart3, Building2, BookOpen,
  Calendar, Clock, Users, LogOut, Menu, X,
  ClipboardList, ScrollText, Shield, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Settings
} from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { AppLauncher } from '@/components/ui/AppLauncher'
import { AppLayout } from '@/components/layout/AppLayout'

interface NavGroup {
  title: string
  items: {
    to: string
    label: string
    icon: ReactNode
  }[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { to: '/admin/submissions', label: 'Submissions', icon: <FileText size={18} /> },
      { to: '/admin/consolidation', label: 'Consolidation', icon: <ClipboardList size={18} /> },
      { to: '/admin/reports', label: 'Reports & Analytics', icon: <BarChart3 size={18} /> },
    ],
  },
  {
    title: 'Academic Structure',
    items: [
      { to: '/admin/schools', label: 'Schools', icon: <Building2 size={18} /> },
      { to: '/admin/learning-areas', label: 'Learning Areas', icon: <BookOpen size={18} /> },
      { to: '/admin/school-years', label: 'School Years', icon: <Calendar size={18} /> },
      { to: '/admin/terms', label: 'Terms & Quarters', icon: <Clock size={18} /> },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/admin/staff', label: 'Faculty & Staff', icon: <Users size={18} /> },
      { to: '/admin/administrators', label: 'Administrators', icon: <Shield size={18} /> },
      { to: '/admin/audit-log', label: 'Audit Logs', icon: <ScrollText size={18} /> },
      { to: '/admin/settings', label: 'System Settings', icon: <Settings size={18} /> },
    ],
  },
]

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppLayout activeSystemId="termcat" systemTitle="TERMCAT System" navGroups={navGroups}>
      {children}
    </AppLayout>
  )
}

