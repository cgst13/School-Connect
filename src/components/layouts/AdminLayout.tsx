import { useState, ReactNode } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FileText, BarChart3, Building2, BookOpen,
  Calendar, Clock, Users, LogOut, Menu, X,
  ClipboardList, ScrollText, Shield, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Settings, Grid, AlertTriangle, Scale
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


export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppLayout activeSystemId="termcat" systemTitle="TERMCAT System" navGroups={navGroups}>
      {children}
    </AppLayout>
  )
}

