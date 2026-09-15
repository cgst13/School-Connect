import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/useAuth'
import { ToastProvider } from '@/hooks/useToast'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'

import { LandingPage } from '@/pages/public/LandingPage'
import { SubmissionPage } from '@/pages/public/SubmissionPage'
import { TeacherSubmissionsPage } from '@/pages/public/TeacherSubmissionsPage'

// Admin pages
import { AdminLoginPage } from '@/pages/admin/LoginPage'
import { DashboardPage } from '@/pages/admin/DashboardPage'
import { SubmissionsPage } from '@/pages/admin/SubmissionsPage'
import { SubmissionDetailPage } from '@/pages/admin/SubmissionDetailPage'
import { SubmissionEditPage } from '@/pages/admin/SubmissionEditPage'
import { ConsolidationPage } from '@/pages/admin/ConsolidationPage'
import { ReportsPage } from '@/pages/admin/ReportsPage'
import { SchoolsPage } from '@/pages/admin/SchoolsPage'
import { LearningAreasPage } from '@/pages/admin/LearningAreasPage'
import { SchoolYearsPage, TermsPage } from '@/pages/admin/SchoolYearsPage'
import { AdministratorsPage } from '@/pages/admin/AdministratorsPage'
import { AuditLogPage } from '@/pages/admin/AuditLogPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/submit" element={<SubmissionPage />} />
            <Route path="/teacher-submissions" element={<TeacherSubmissionsPage />} />

            {/* Admin Auth */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Admin Protected */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/submissions"
              element={
                <ProtectedRoute>
                  <SubmissionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/submissions/:id"
              element={
                <ProtectedRoute>
                  <SubmissionDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/submissions/:id/edit"
              element={
                <ProtectedRoute>
                  <SubmissionEditPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/consolidation"
              element={
                <ProtectedRoute>
                  <ConsolidationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/schools"
              element={
                <ProtectedRoute>
                  <SchoolsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/learning-areas"
              element={
                <ProtectedRoute>
                  <LearningAreasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/school-years"
              element={
                <ProtectedRoute>
                  <SchoolYearsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/terms"
              element={
                <ProtectedRoute>
                  <TermsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/administrators"
              element={
                <ProtectedRoute>
                  <AdministratorsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-log"
              element={
                <ProtectedRoute>
                  <AuditLogPage />
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
