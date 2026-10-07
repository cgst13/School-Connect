import { ReactNode } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { termcatNavGroups } from '@/config/navConfigs'

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppLayout activeSystemId="termcat" systemTitle="TERMCAT System" navGroups={termcatNavGroups}>
      {children}
    </AppLayout>
  )
}

