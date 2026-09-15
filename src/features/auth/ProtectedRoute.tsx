import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { PageLoader } from '@/components/ui/EmptyState'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, admin, loading } = useAuth()

  if (loading) return <PageLoader />

  if (!user || !admin) {
    return <Navigate to="/admin/login" replace />
  }

  if (!admin.is_active) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-sm">
          <h1 className="text-lg font-bold text-content-primary">Account Deactivated</h1>
          <p className="text-sm text-content-secondary mt-2">
            Your admin account has been deactivated. Please contact your system administrator.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
