import { useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Printer,
  Download,
  Copy,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  Building2,
  Phone,
  MapPin,
  User,
  QrCode,
  School as SchoolIcon
} from 'lucide-react'
import type { Learner } from '@/types'
import { useToast } from '@/hooks/useToast'
import { generateLearnerQRCode, getLearnerQRValue } from '@/utils/qrCodeGenerator'

interface SchoolIDCardModalProps {
  isOpen: boolean
  onClose: () => void
  learner: Learner
}

export function SchoolIDCardModal({ isOpen, onClose, learner }: SchoolIDCardModalProps) {
  const { toast } = useToast()
  const [copiedToken, setCopiedToken] = useState(false)
  const [activeSide, setActiveSide] = useState<'both' | 'front' | 'back'>('both')
  const printAreaRef = useRef<HTMLDivElement>(null)

  if (!isOpen || !learner) return null

  const qrValue = getLearnerQRValue(learner)
  const fullName = `${learner.last_name}, ${learner.first_name} ${learner.middle_name || ''} ${learner.extension_name || ''}`.trim()
  const schoolName = learner.school_name || 'Republic of the Philippines'
  const gradeSection = `${learner.grade_level_name || 'Grade Level'} - ${learner.section_name || 'Section'}`
  const emergencyPerson = learner.guardian_name || learner.father_name || learner.mother_maiden_name || 'Parent / Legal Guardian'
  const emergencyPhone = learner.guardian_contact_no || 'N/A'
  const fullAddress = [learner.address_house_no, learner.address_street, learner.address_barangay, learner.address_city_municipality, learner.address_province]
    .filter(Boolean)
    .join(', ') || 'Philippines'

  const handlePrint = () => {
    window.print()
  }

  const handleCopyQR = () => {
    navigator.clipboard.writeText(qrValue)
    setCopiedToken(true)
    toast('QR Code Token copied to clipboard', 'success')
    setTimeout(() => setCopiedToken(false), 2000)
  }

  const downloadQRSVG = () => {
    const svgElement = document.getElementById(`qr-svg-${learner.id}`)
    if (!svgElement) return
    const svgData = new XMLSerializer().serializeToString(svgElement)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    const downloadLink = document.createElement('a')
    downloadLink.href = svgUrl
    downloadLink.download = `QR_${learner.lrn || learner.last_name}.svg`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    URL.revokeObjectURL(svgUrl)
    toast('QR Code SVG downloaded successfully', 'success')
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none">
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Official DepEd Student ID Card & QR Code
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                  Automated QR
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Ready for high-resolution card printing and scannable attendance verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-blue-500/20 active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              Print ID Card
            </button>
            <button
              onClick={downloadQRSVG}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all active:scale-95"
              title="Download QR SVG"
            >
              <Download className="w-3.5 h-3.5" />
              QR Code
            </button>
            <button
              onClick={handleCopyQR}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all active:scale-95"
              title="Copy Unique QR Token"
            >
              {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedToken ? 'Copied' : 'Copy Token'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/40 print:p-0 print:bg-white">
          {/* Card View Switcher (Hidden in Print) */}
          <div className="flex items-center justify-between gap-4 print:hidden bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Display:</span>
              <div className="inline-flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveSide('both')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeSide === 'both' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Both Sides (Front & Back)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSide('front')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeSide === 'front' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Front Only
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSide('back')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeSide === 'back' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Back Only
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Standard DepEd CR-80 PVC Card Format (3.375" × 2.125")
            </div>
          </div>

          {/* Printable Cards Container */}
          <div
            ref={printAreaRef}
            id="deped-id-card-print"
            className="flex flex-wrap items-center justify-center gap-8 py-2 print:py-0 print:gap-4 print:m-0"
          >
            {/* FRONT OF ID */}
            {(activeSide === 'both' || activeSide === 'front') && (
              <div className="w-[340px] h-[520px] bg-white rounded-2xl border-2 border-slate-800 shadow-xl overflow-hidden flex flex-col justify-between relative print:shadow-none print:border-2 print:border-slate-800 shrink-0 select-none">
                {/* Header with DepEd Branding */}
                <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white p-3.5 text-center relative">
                  <div className="absolute top-2.5 left-3 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center p-1 border border-white/20">
                    <SchoolIcon className="w-4 h-4 text-amber-300" />
                  </div>
                  <div className="absolute top-2.5 right-3 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center p-1 border border-white/20">
                    <GraduationCap className="w-4 h-4 text-blue-300" />
                  </div>
                  <p className="text-[9px] font-semibold tracking-wider text-blue-200 uppercase">
                    Republic of the Philippines
                  </p>
                  <p className="text-[10px] font-bold tracking-tight text-white uppercase">
                    Department of Education
                  </p>
                  <p className="text-[11px] font-extrabold text-amber-300 tracking-tight leading-tight mt-0.5 px-7 line-clamp-1">
                    {schoolName}
                  </p>
                  <p className="text-[8px] text-blue-200/90 tracking-wider uppercase mt-0.5">
                    SY {learner.school_year || '2026 - 2027'}
                  </p>
                </div>

                {/* Body Details */}
                <div className="p-4 flex flex-col items-center text-center space-y-3 flex-1">
                  {/* Student Photo Placeholder */}
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-blue-600 flex flex-col items-center justify-center text-slate-400 relative shadow-inner overflow-hidden">
                    <User className="w-12 h-12 text-slate-400/80" />
                    <span className="text-[8px] font-bold text-slate-500 absolute bottom-1">
                      PHOTO
                    </span>
                  </div>

                  {/* Student Full Name */}
                  <div className="space-y-0.5 max-w-full">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-2 leading-tight">
                      {learner.last_name}, {learner.first_name}
                    </h4>
                    {learner.middle_name && (
                      <p className="text-[11px] font-semibold text-slate-600 uppercase">
                        {learner.middle_name} {learner.extension_name || ''}
                      </p>
                    )}
                    <span className="inline-block px-2.5 py-0.5 mt-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      STUDENT
                    </span>
                  </div>

                  {/* Academic Level & Section */}
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-center space-y-0.5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Grade & Section
                    </p>
                    <p className="text-xs font-black text-slate-800">
                      {gradeSection}
                    </p>
                  </div>

                  {/* LRN & Scannable QR Code */}
                  <div className="w-full bg-white border border-slate-200/90 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="text-left space-y-0.5">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Learner Ref. No. (LRN)
                      </p>
                      <p className="text-xs font-mono font-black text-blue-900 tracking-wider">
                        {learner.lrn}
                      </p>
                      <div className="flex items-center gap-1 text-[8px] text-emerald-600 font-semibold pt-0.5">
                        <ShieldCheck className="w-3 h-3" />
                        Official DepEd LRN
                      </div>
                    </div>

                    {/* High Precision SVG QR Code */}
                    <div className="p-1.5 bg-white rounded-lg border border-slate-200 shrink-0 shadow-2xs transition-all duration-300 ease-out origin-bottom-right cursor-zoom-in hover:scale-160 hover:shadow-2xl hover:border-blue-400 hover:z-30 relative print:transform-none">
                      <QRCodeSVG
                        id={`qr-svg-${learner.id}`}
                        value={qrValue}
                        size={80}
                        level="L"
                        includeMargin={true}
                        className="transition-transform duration-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Card Footer Stripe */}
                <div className="bg-blue-900 text-white px-3 py-1.5 text-center flex items-center justify-between text-[9px] font-medium border-t border-blue-950">
                  <span className="font-bold text-amber-300">DepEd SchoolConnect</span>
                  <span className="font-mono text-[8px] text-blue-200">LRN: {learner.lrn}</span>
                </div>
              </div>
            )}

            {/* BACK OF ID */}
            {(activeSide === 'both' || activeSide === 'back') && (
              <div className="w-[340px] h-[520px] bg-white rounded-2xl border-2 border-slate-800 shadow-xl overflow-hidden flex flex-col justify-between relative print:shadow-none print:border-2 print:border-slate-800 shrink-0 select-none">
                {/* Back Top Stripe */}
                <div className="bg-slate-900 text-white p-3 text-center">
                  <p className="text-[10px] font-bold tracking-wider uppercase text-amber-400">
                    Emergency Contact Information
                  </p>
                </div>

                {/* Back Body */}
                <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between text-left">
                  {/* Guardian Details */}
                  <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">
                        Parent / Legal Guardian
                      </p>
                      <p className="text-xs font-bold text-slate-900 uppercase">
                        {emergencyPerson}
                        {learner.guardian_relationship && (
                          <span className="text-[10px] text-slate-500 font-normal ml-1">
                            ({learner.guardian_relationship})
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-slate-800">
                      <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>{emergencyPhone}</span>
                    </div>

                    <div className="flex items-start gap-1.5 pt-1 text-[10px] text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-tight">{fullAddress}</span>
                    </div>
                  </div>

                  {/* QR Code Validation Center */}
                  <div className="border border-dashed border-slate-300 rounded-xl p-2.5 flex items-center gap-3 bg-blue-50/40">
                    <div className="p-1 bg-white rounded-lg border border-slate-200 shrink-0 shadow-2xs transition-all duration-300 ease-out origin-left cursor-zoom-in hover:scale-160 hover:shadow-2xl hover:border-blue-400 hover:z-30 relative print:transform-none">
                      <QRCodeSVG
                        value={qrValue}
                        size={64}
                        level="L"
                        includeMargin={true}
                        className="transition-transform duration-300"
                      />
                    </div>
                    <div className="text-left space-y-0.5">
                      <p className="text-[9px] font-bold text-blue-900 uppercase">
                        DepEd Digital ID Card
                      </p>
                      <p className="text-[8px] text-slate-600 leading-tight">
                        Scan with SchoolConnect SF2 Attendance Scanner or LIS Mobile for instant validation.
                      </p>
                    </div>
                  </div>

                  {/* Loss Notice */}
                  <div className="text-[8px] text-slate-500 italic text-center leading-tight bg-slate-100/80 p-2 rounded-lg">
                    "In case of loss or emergency, please return this card to {schoolName} or call the emergency contact number above."
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-3 pt-2 text-center">
                    <div className="border-t border-slate-400 pt-1">
                      <p className="text-[9px] font-bold text-slate-800">CLASS ADVISER</p>
                      <p className="text-[8px] text-slate-400">Signature over Printed Name</p>
                    </div>
                    <div className="border-t border-slate-400 pt-1">
                      <p className="text-[9px] font-bold text-slate-800">SCHOOL HEAD</p>
                      <p className="text-[8px] text-slate-400">Principal / Head Teacher</p>
                    </div>
                  </div>
                </div>

                {/* Back Footer */}
                <div className="bg-slate-900 text-white p-2 text-center text-[8px] font-mono tracking-wider">
                  PROPERTY OF DEPARTMENT OF EDUCATION
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer (Hidden in Print) */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">QR Payload:</span>
            <code className="px-2 py-0.5 bg-slate-100 rounded text-blue-600 font-mono text-[11px]">
              {qrValue}
            </code>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-blue-500/20 active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              Print ID Card
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
