import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/useAuth'
import { ToastProvider } from '@/hooks/useToast'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'

import { LandingPage } from '@/pages/public/LandingPage'
import { SubmissionPage } from '@/pages/public/SubmissionPage'
import { TeacherSubmissionsPage } from '@/pages/public/TeacherSubmissionsPage'

// School Connect Portal pages
import { SchoolConnectHubPage } from '@/pages/portal/SchoolConnectHubPage'
import { SchoolConnectLoginPage } from '@/pages/portal/SchoolConnectLoginPage'
import { FacultyStaffPage } from '@/pages/portal/FacultyStaffPage'

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
import { TermcatSettingsPage } from '@/pages/admin/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Default Landing Page -> School Connect Login */}
            <Route path="/" element={<SchoolConnectLoginPage />} />
            <Route path="/login" element={<SchoolConnectLoginPage />} />

            {/* Public Portal Link (Publicly Accessible Submission Status Page) */}
            <Route path="/public" element={<LandingPage />} />

            {/* School Connect Applications Hub (Protected) */}
            <Route
              path="/portal"
              element={
                <ProtectedRoute>
                  <SchoolConnectHubPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portal/staff"
              element={
                <ProtectedRoute>
                  <FacultyStaffPage />
                </ProtectedRoute>
              }
            />

            {/* Opening TERMCAT redirects directly to TERMCAT Admin Dashboard */}
            <Route
              path="/termcat"
              element={
                <ProtectedRoute>
                  <Navigate to="/admin" replace />
                </ProtectedRoute>
              }
            />
            {/* Public Teacher Submission Form & Record Pages */}
            <Route path="/submit" element={<SubmissionPage />} />
            <Route path="/teacher-submissions" element={<TeacherSubmissionsPage />} />

            {/* Admin Auth */}
            <Route path="/admin/login" element={<SchoolConnectLoginPage />} />

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
              path="/admin/staff"
              element={
                <ProtectedRoute>
                  <FacultyStaffPage />
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
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <TermcatSettingsPage />
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
