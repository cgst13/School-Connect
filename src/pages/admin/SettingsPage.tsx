import { useState } from 'react'
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Globe,
  Settings,
  Share2,
  Lock,
  CheckCircle2
} from 'lucide-react'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { PageContainer, PageHeader, PageTitle, PageDescription, Section, SectionHeader } from '@/components/layout/PageLayout'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { useToast } from '@/hooks/useToast'

export function TermcatSettingsPage() {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [allowPublicSubmissions, setAllowPublicSubmissions] = useState(true)

  const publicPortalUrl = `${window.location.origin}/public`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicPortalUrl)
    setCopied(true)
    toast('Public portal link copied to clipboard!', 'success')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <AdminLayout>
      <PageContainer>
      <PageHeader>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#0B1F3A] text-white rounded">
              TERMCAT Settings
            </span>
          </div>
          <PageTitle>TERMCAT Module Settings & Public Links</PageTitle>
          <PageDescription>
            Manage public teacher submission portal links, TERMCAT submission parameters, and report header branding.
          </PageDescription>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings Card */}
        <div className="lg:col-span-2 space-y-6">
          <Section>
            <SectionHeader
              title="Public Teacher Submission Link"
              description="Share this link with school teachers to submit evaluation forms and view district compliance matrix."
            />

            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-[#E2E8F0] space-y-3">
                <label className="block text-xs font-bold text-[#111827]">
                  Official Public Portal URL
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Globe className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      readOnly
                      value={publicPortalUrl}
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono font-medium bg-white border border-[#E2E8F0] rounded-lg text-[#111827] select-all focus:outline-none"
                    />
                  </div>

                  <IconButton
                    icon={copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    aria-label="Copy public portal link"
                    tooltip={copied ? "Copied!" : "Copy Link"}
                    onClick={handleCopyLink}
                    variant="secondary"
                  />

                  <a
                    href={publicPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#0B1F3A] hover:bg-[#07152A] rounded-lg transition-colors shadow-xs"
                  >
                    <span>Open Link</span>
                    <ExternalLink size={14} />
                  </a>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-[#64748B] pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>No teacher login required for public submissions.</span>
                </div>
              </div>

              {/* Submission Controls */}
              <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
                <h4 className="text-xs font-bold text-[#111827]">Public Access Control</h4>
                
                <div className="flex items-center justify-between p-3 rounded-lg border border-[#E2E8F0] bg-white">
                  <div>
                    <div className="text-xs font-bold text-[#111827]">Allow Public Submissions</div>
                    <div className="text-[11px] text-[#64748B]">
                      When active, teachers with the public link can submit evaluation forms.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAllowPublicSubmissions(!allowPublicSubmissions)
                      toast(`Public submissions ${!allowPublicSubmissions ? 'enabled' : 'disabled'}.`, 'info')
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      allowPublicSubmissions ? 'bg-[#0B1F3A]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        allowPublicSubmissions ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* District Branding Info */}
          <Section>
            <SectionHeader
              title="District & Department Information"
              description="Institutional identifiers applied to official printouts and exported consolidation reports."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
              <div>
                <label className="block font-bold text-[#111827] mb-1">Region & Division</label>
                <input
                  type="text"
                  readOnly
                  value="Region IV-B (MIMAROPA) · Division of Romblon"
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-lg text-[#64748B]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#111827] mb-1">District Name</label>
                <input
                  type="text"
                  readOnly
                  value="District of Concepcion"
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-lg text-[#64748B]"
                />
              </div>
            </div>
          </Section>
        </div>

        {/* Right Info Panel */}
        <div className="space-y-6">
          <Section>
            <SectionHeader title="Public Link Quick Instructions" />
            <div className="space-y-3 text-xs text-[#64748B]">
              <p>
                1. Copy the official public link using the <strong className="text-[#111827]">Copy Link</strong> button above.
              </p>
              <p>
                2. Distribute the link to School Heads and Teachers via official DepEd communication channels.
              </p>
              <p>
                3. Submissions will automatically log into TERMCAT Submissions & Monitoring for admin review.
              </p>
            </div>
          </Section>

          <Section className="bg-[#0B1F3A] text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/10 text-white">
                <Shield size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold">School Connect Integration</h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  TERMCAT is connected to School Connect SSO Platform.
                </p>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </PageContainer>
    </AdminLayout>
  )
}
