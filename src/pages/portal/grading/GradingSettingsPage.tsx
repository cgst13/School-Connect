import { useState } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { gradingNavGroups } from '@/config/navConfigs'
import { PageHeader } from '@/components/ui/PageHeader'
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
  CheckCircle2
} from 'lucide-react'

export function GradingSettingsPage() {
  const { toast } = useToast()

  const [weights, setWeights] = useState<Record<string, SubjectWeightConfig>>({
    languages_ap_esp: { ...DEPED_DEFAULT_WEIGHTS.languages_ap_esp },
    science_math: { ...DEPED_DEFAULT_WEIGHTS.science_math },
    mapeh_epp_tle: { ...DEPED_DEFAULT_WEIGHTS.mapeh_epp_tle },
  })

  const [passingGrade, setPassingGrade] = useState<number>(75)
  const [transmutationEnabled, setTransmutationEnabled] = useState<boolean>(true)

  const handleSaveSettings = () => {
    toast('Grading settings & DepEd weight configurations saved!', 'success')
  }

  const handleResetDefaults = () => {
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
            </div>
          }
        />

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
                      value={weights.languages_ap_esp.writtenWorks}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        languages_ap_esp: { ...prev.languages_ap_esp, writtenWorks: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold"
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Performance Tasks (PT):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={weights.languages_ap_esp.performanceTasks}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        languages_ap_esp: { ...prev.languages_ap_esp, performanceTasks: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold"
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Quarterly Assessment (QA):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={weights.languages_ap_esp.quarterlyAssessment}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        languages_ap_esp: { ...prev.languages_ap_esp, quarterlyAssessment: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold"
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
                      value={weights.science_math.writtenWorks}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        science_math: { ...prev.science_math, writtenWorks: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold"
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Performance Tasks (PT):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={weights.science_math.performanceTasks}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        science_math: { ...prev.science_math, performanceTasks: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold"
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Quarterly Assessment (QA):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={weights.science_math.quarterlyAssessment}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        science_math: { ...prev.science_math, quarterlyAssessment: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold"
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
                      value={weights.mapeh_epp_tle.writtenWorks}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        mapeh_epp_tle: { ...prev.mapeh_epp_tle, writtenWorks: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold"
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Performance Tasks (PT):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={weights.mapeh_epp_tle.performanceTasks}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        mapeh_epp_tle: { ...prev.mapeh_epp_tle, performanceTasks: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold"
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Quarterly Assessment (QA):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={weights.mapeh_epp_tle.quarterlyAssessment}
                      onChange={e => setWeights(prev => ({
                        ...prev,
                        mapeh_epp_tle: { ...prev.mapeh_epp_tle, quarterlyAssessment: parseInt(e.target.value, 10) || 0 }
                      }))}
                      className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold"
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
