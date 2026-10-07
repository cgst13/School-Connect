import { useState } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { gradingNavGroups } from '@/config/navConfigs'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  DEPED_DEFAULT_WEIGHTS,
  SubjectWeightConfig
} from '@/utils/gradingCalculator'
import {
  Settings,
  Save,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  BookOpen,
  Info,
  CheckCircle2,
  Lock,
  Eye
} from 'lucide-react'

export function GradingSettingsPage() {
  const { admin, canEditGrades } = useAuth()
  const { toast } = useToast()
  const isEditable = canEditGrades()

  const [weights, setWeights] = useState<Record<string, SubjectWeightConfig>>({
    languages_ap_esp: { ...DEPED_DEFAULT_WEIGHTS.languages_ap_esp },
    science_math: { ...DEPED_DEFAULT_WEIGHTS.science_math },
    mapeh_epp_tle: { ...DEPED_DEFAULT_WEIGHTS.mapeh_epp_tle },
  })

  const [passingGrade, setPassingGrade] = useState<number>(75)
  const [transmutationEnabled, setTransmutationEnabled] = useState<boolean>(true)

  const handleSaveSettings = () => {
    if (!isEditable) {
      toast('Unauthorized: Only teachers and administrators can configure grading settings.', 'error')
      return
    }
    toast('Grading settings & DepEd weight configurations saved!', 'success')
  }

  const handleResetDefaults = () => {
    if (!isEditable) {
      toast('Unauthorized: Only teachers and administrators can configure grading settings.', 'error')
      return
    }
    setWeights({
      languages_ap_esp: { ...DEPED_DEFAULT_WEIGHTS.languages_ap_esp },
      science_math: { ...DEPED_DEFAULT_WEIGHTS.science_math },
      mapeh_epp_tle: { ...DEPED_DEFAULT_WEIGHTS.mapeh_epp_tle },
    })
    setPassingGrade(75)
    setTransmutationEnabled(true)
    toast('Reset to official DepEd DO 8, s. 2015 defaults.', 'info')
  }

  return (
    <SchoolConnectLayout systemTitle="e-Class Record & Grading Portal" navGroups={gradingNavGroups}>
      <div className="space-y-6 max-w-[1200px] mx-auto pb-16">
        
        {/* Page Header */}
        <PageHeader
          title="Grading System Configuration"
          description="Configure DepEd component weight distributions, passing thresholds, and official transmutation standards"
          badge="DepEd Order No. 8, s. 2015"
          actions={
            <div className="flex items-center gap-2">
              {isEditable ? (
                <>
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={14} className="text-slate-500" />
                    Reset Defaults
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save size={14} />
                    Save Settings
                  </button>
                </>
              ) : (
                <div className="px-3.5 py-2 bg-slate-100 text-slate-500 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs inline-flex items-center gap-1.5 cursor-not-allowed select-none">
                  <Lock size={14} className="text-slate-400" />
                  <span>View Only Mode</span>
                </div>
              )}
            </div>
          }
        />

        {/* View-Only Alert for Non-Admin/Non-Teacher */}
        {!isEditable && (
          <div className="p-4 bg-amber-50/90 rounded-2xl border border-amber-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Grading Settings: View-Only Access Mode
                </h4>
                <p className="text-xs text-amber-800/90 mt-0.5">
                  You are viewing the grading system configuration in read-only mode. AO II, School Head, and PSDS accounts cannot modify weight distributions.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-900 text-xs font-bold rounded-xl border border-amber-200 shadow-2xs shrink-0">
              <Eye className="w-3.5 h-3.5 text-amber-600" />
              <span>Read Only</span>
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 leading-relaxed">
            <strong className="block font-bold">Official DepEd Policy Guidelines (DO 8, s. 2015 / MATATAG):</strong>
            Component weights automatically compute Written Works (WW), Performance Tasks (PT), and Quarterly Assessment (QA) into Initial Grades, which are transmuted via the DepEd Standard Transmutation Scale.
          </div>
        </div>

        {/* Weights Configuration Grid */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-blue-600" />
            Learning Area Weight Profiles
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Languages, AP, EsP */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 uppercase">
                  Profile A
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-1.5">Languages, AP &amp; EsP</h4>
                <p className="text-xs text-slate-500">English, Filipino, Mother Tongue, Araling Panlipunan, Values</p>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Written Works (WW):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={!isEditable}
                      readOnly={!isEditable}
                      value={weights.languages_ap_esp.writtenWorks}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        languages_ap_esp: { ...prev.languages_ap_esp, writtenWorks: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className={`w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold ${!isEditable ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Performance Tasks (PT):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={!isEditable}
                      readOnly={!isEditable}
                      value={weights.languages_ap_esp.performanceTasks}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        languages_ap_esp: { ...prev.languages_ap_esp, performanceTasks: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className={`w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold ${!isEditable ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Quarterly Assessment (QA):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={!isEditable}
                      readOnly={!isEditable}
                      value={weights.languages_ap_esp.quarterlyAssessment}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        languages_ap_esp: { ...prev.languages_ap_esp, quarterlyAssessment: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className={`w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold ${!isEditable ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Science & Math */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 uppercase">
                  Profile B
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-1.5">Science &amp; Mathematics</h4>
                <p className="text-xs text-slate-500">General Science, Biology, Chemistry, Physics, Math</p>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Written Works (WW):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={!isEditable}
                      readOnly={!isEditable}
                      value={weights.science_math.writtenWorks}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        science_math: { ...prev.science_math, writtenWorks: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className={`w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold ${!isEditable ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Performance Tasks (PT):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={!isEditable}
                      readOnly={!isEditable}
                      value={weights.science_math.performanceTasks}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        science_math: { ...prev.science_math, performanceTasks: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className={`w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold ${!isEditable ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Quarterly Assessment (QA):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={!isEditable}
                      readOnly={!isEditable}
                      value={weights.science_math.quarterlyAssessment}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        science_math: { ...prev.science_math, quarterlyAssessment: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className={`w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold ${!isEditable ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MAPEH, EPP, TLE */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase">
                  Profile C
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-1.5">MAPEH &amp; EPP / TLE</h4>
                <p className="text-xs text-slate-500">Music, Arts, PE, Health, Edukasyong Pantahanan at Pangkabuhayan</p>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Written Works (WW):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={!isEditable}
                      readOnly={!isEditable}
                      value={weights.mapeh_epp_tle.writtenWorks}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        mapeh_epp_tle: { ...prev.mapeh_epp_tle, writtenWorks: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className={`w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold ${!isEditable ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Performance Tasks (PT):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={!isEditable}
                      readOnly={!isEditable}
                      value={weights.mapeh_epp_tle.performanceTasks}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        mapeh_epp_tle: { ...prev.mapeh_epp_tle, performanceTasks: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className={`w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold ${!isEditable ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Quarterly Assessment (QA):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      disabled={!isEditable}
                      readOnly={!isEditable}
                      value={weights.mapeh_epp_tle.quarterlyAssessment}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        mapeh_epp_tle: { ...prev.mapeh_epp_tle, quarterlyAssessment: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className={`w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold ${!isEditable ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </SchoolConnectLayout>
  )
}
