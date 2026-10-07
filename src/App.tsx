import { Suspense, lazy, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/useAuth'
import { ToastProvider } from '@/hooks/useToast'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'

// Component to ensure GIF plays for at least 1 full round (~1500ms) on page refresh
function PageRefreshGifGuard({ children }: { children: React.ReactNode }) {
  const [showMinGif, setShowMinGif] = useState(true)

  useEffect(() => {
    // 1500ms = ~1 full round of GIF playback on page refresh
    const timer = setTimeout(() => {
      setShowMinGif(false)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      {children}
      {showMinGif && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#fcfcff] select-none">
          <img
            src="/images/loading.gif"
            alt="Loading..."
            className="w-[450px] h-[450px] sm:w-[650px] sm:h-[650px] max-w-[90vw] max-h-[90vh] object-contain bg-transparent"
          />
        </div>
      )}
    </>
  )
}

function PageLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#fcfcff] select-none">
      <img
        src="/images/loading.gif"
        alt="Loading..."
        className="w-[450px] h-[450px] sm:w-[650px] sm:h-[650px] max-w-[90vw] max-h-[90vh] object-contain bg-transparent"
      />
    </div>
  )
}

// Lazy-loaded Public Pages
const LandingPage = lazy(() => import('@/pages/public/LandingPage').then(m => ({ default: m.LandingPage })))
const SubmissionPage = lazy(() => import('@/pages/public/SubmissionPage').then(m => ({ default: m.SubmissionPage })))
const TeacherSubmissionsPage = lazy(() => import('@/pages/public/TeacherSubmissionsPage').then(m => ({ default: m.TeacherSubmissionsPage })))
const SchoolSubmissionsPage = lazy(() => import('@/pages/public/SchoolSubmissionsPage').then(m => ({ default: m.SchoolSubmissionsPage })))
const PublicOrgChartPage = lazy(() => import('@/pages/public/PublicOrgChartPage').then(m => ({ default: m.PublicOrgChartPage })))

// Lazy-loaded School Connect Portal Pages
const SchoolConnectHubPage = lazy(() => import('@/pages/portal/SchoolConnectHubPage').then(m => ({ default: m.SchoolConnectHubPage })))
const SchoolConnectLoginPage = lazy(() => import('@/pages/portal/SchoolConnectLoginPage').then(m => ({ default: m.SchoolConnectLoginPage })))
const FacultyStaffPage = lazy(() => import('@/pages/portal/FacultyStaffPage').then(m => ({ default: m.FacultyStaffPage })))
const NotesPage = lazy(() => import('@/pages/portal/NotesPage').then(m => ({ default: m.NotesPage })))
const DTRGeneratorPage = lazy(() => import('@/pages/portal/DTRGeneratorPage').then(m => ({ default: m.DTRGeneratorPage })))
const LISDirectoryPage = lazy(() => import('@/pages/portal/lis/LISDirectoryPage').then(m => ({ default: m.LISDirectoryPage })))
const LISSF1Page = lazy(() => import('@/pages/portal/lis/LISSF1Page').then(m => ({ default: m.LISSF1Page })))
const LISSF2Page = lazy(() => import('@/pages/portal/lis/LISSF2Page').then(m => ({ default: m.LISSF2Page })))
const LISEnrollmentPage = lazy(() => import('@/pages/portal/lis/LISEnrollmentPage').then(m => ({ default: m.LISEnrollmentPage })))
const LISAnalyticsPage = lazy(() => import('@/pages/portal/lis/LISAnalyticsPage').then(m => ({ default: m.LISAnalyticsPage })))
const LearnerProfilePage = lazy(() => import('@/pages/portal/lis/LearnerProfilePage').then(m => ({ default: m.LearnerProfilePage })))

// Lazy-loaded e-Class Record & Grading Portal Pages
const GradingClassRecordPage = lazy(() => import('@/pages/portal/grading/GradingClassRecordPage').then(m => ({ default: m.GradingClassRecordPage })))
const GradingSummaryPage = lazy(() => import('@/pages/portal/grading/GradingSummaryPage').then(m => ({ default: m.GradingSummaryPage })))
const GradingSF9Page = lazy(() => import('@/pages/portal/grading/GradingSF9Page').then(m => ({ default: m.GradingSF9Page })))
const GradingSF5Page = lazy(() => import('@/pages/portal/grading/GradingSF5Page').then(m => ({ default: m.GradingSF5Page })))
const GradingSettingsPage = lazy(() => import('@/pages/portal/grading/GradingSettingsPage').then(m => ({ default: m.GradingSettingsPage })))

// Lazy-loaded Admin Pages
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage').then(m => ({ default: m.DashboardPage })))
const SubmissionsPage = lazy(() => import('@/pages/admin/SubmissionsPage').then(m => ({ default: m.SubmissionsPage })))
const SubmissionDetailPage = lazy(() => import('@/pages/admin/SubmissionDetailPage').then(m => ({ default: m.SubmissionDetailPage })))
const SubmissionEditPage = lazy(() => import('@/pages/admin/SubmissionEditPage').then(m => ({ default: m.SubmissionEditPage })))
const ConsolidationPage = lazy(() => import('@/pages/admin/ConsolidationPage').then(m => ({ default: m.ConsolidationPage })))
const LearnerMismatchPage = lazy(() => import('@/pages/admin/LearnerMismatchPage').then(m => ({ default: m.LearnerMismatchPage })))
const SubjectConsistencyPage = lazy(() => import('@/pages/admin/SubjectConsistencyPage').then(m => ({ default: m.SubjectConsistencyPage })))
const CompetenciesPage = lazy(() => import('@/pages/admin/CompetenciesPage').then(m => ({ default: m.CompetenciesPage })))
const ReportsPage = lazy(() => import('@/pages/admin/ReportsPage').then(m => ({ default: m.ReportsPage })))
const SchoolsPage = lazy(() => import('@/pages/admin/SchoolsPage').then(m => ({ default: m.SchoolsPage })))
const LearningAreasPage = lazy(() => import('@/pages/admin/LearningAreasPage').then(m => ({ default: m.LearningAreasPage })))
const SchoolYearsPage = lazy(() => import('@/pages/admin/SchoolYearsPage').then(m => ({ default: m.SchoolYearsPage })))
const TermsPage = lazy(() => import('@/pages/admin/SchoolYearsPage').then(m => ({ default: m.TermsPage })))
const SectionsPage = lazy(() => import('@/pages/admin/SectionsPage').then(m => ({ default: m.SectionsPage })))
const AdministratorsPage = lazy(() => import('@/pages/admin/AdministratorsPage').then(m => ({ default: m.AdministratorsPage })))
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage').then(m => ({ default: m.AuditLogPage })))
const TermcatSettingsPage = lazy(() => import('@/pages/admin/SettingsPage').then(m => ({ default: m.TermcatSettingsPage })))
const SystemSettingsPage = lazy(() => import('@/pages/admin/SystemSettingsPage').then(m => ({ default: m.SystemSettingsPage })))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <PageRefreshGifGuard>
            <Suspense fallback={<PageLoader />}>
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
                path="/notes"
                element={
                  <ProtectedRoute>
                    <NotesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dtr"
                element={
                  <ProtectedRoute>
                    <DTRGeneratorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lis"
                element={
                  <ProtectedRoute>
                    <Navigate to="/lis/directory" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lis/directory"
                element={
                  <ProtectedRoute>
                    <LISDirectoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lis/sf1"
                element={
                  <ProtectedRoute>
                    <LISSF1Page />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lis/sf2"
                element={
                  <ProtectedRoute>
                    <LISSF2Page />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lis/enrollment"
                element={
                  <ProtectedRoute>
                    <LISEnrollmentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lis/analytics"
                element={
                  <ProtectedRoute>
                    <LISAnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lis/learner/:id"
                element={
                  <ProtectedRoute>
                    <LearnerProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lis/learners/:id"
                element={
                  <ProtectedRoute>
                    <LearnerProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sis"
                element={
                  <ProtectedRoute>
                    <Navigate to="/lis/directory" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/portal/staff"
                element={
                  <ProtectedRoute requireAdmin>
                    <FacultyStaffPage />
                  </ProtectedRoute>
                }
              />

              {/* e-Class Record & Grading Management Portal Routes */}
              <Route
                path="/grading"
                element={
                  <ProtectedRoute>
                    <Navigate to="/grading/class-record" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/grading/class-record"
                element={
                  <ProtectedRoute>
                    <GradingClassRecordPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/grading/summary"
                element={
                  <ProtectedRoute>
                    <GradingSummaryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/grading/sf9"
                element={
                  <ProtectedRoute>
                    <GradingSF9Page />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/grading/sf5"
                element={
                  <ProtectedRoute>
                    <GradingSF5Page />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/grading/settings"
                element={
                  <ProtectedRoute>
                    <GradingSettingsPage />
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
              {/* Public Teacher & School Submission Form & Record Pages */}
              <Route path="/submit" element={<SubmissionPage />} />
              <Route path="/teacher-submissions" element={<TeacherSubmissionsPage />} />
              <Route path="/school-submissions" element={<SchoolSubmissionsPage />} />
              <Route path="/org-chart" element={<PublicOrgChartPage />} />

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
                  <ProtectedRoute requireAdmin>
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
                path="/admin/learner-mismatch"
                element={
                  <ProtectedRoute>
                    <LearnerMismatchPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/learner-consistency"
                element={
                  <ProtectedRoute>
                    <SubjectConsistencyPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/competencies"
                element={
                  <ProtectedRoute>
                    <CompetenciesPage />
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
                path="/admin/sections"
                element={
                  <ProtectedRoute>
                    <SectionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/administrators"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdministratorsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/audit-log"
                element={
                  <ProtectedRoute requireAdmin>
                    <AuditLogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/audit-logs"
                element={
                  <ProtectedRoute requireAdmin>
                    <AuditLogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/system-settings"
                element={
                  <ProtectedRoute requireAdmin>
                    <SystemSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute requireAdmin>
                    <TermcatSettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </PageRefreshGifGuard>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
