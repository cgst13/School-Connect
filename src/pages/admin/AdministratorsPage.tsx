import { useEffect, useState } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import { fetchAllAdmins, insertAuditLog } from '@/lib/supabase/queries'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type { AdminProfile } from '@/types'
import { Plus, Shield } from 'lucide-react'
import { format } from 'date-fns'
import { EmptyState } from '@/components/ui/EmptyState'

export function AdministratorsPage() {
  const { admin } = useAuth()
  const { toast } = useToast()
  const [admins, setAdmins] = useState<AdminProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [inviting, setInviting] = useState(false)

  const load = () => { setLoading(true); fetchAllAdmins().then(setAdmins).finally(() => setLoading(false)) }
  useEffect(load, [])

  const handleToggleActive = async (ap: AdminProfile) => {
    const { error } = await supabase.from('termcat_admin_profiles').update({ is_active: !ap.is_active }).eq('id', ap.id)
    if (error) { toast('Failed to update.', 'error'); return }
    await insertAuditLog({ admin_id: admin!.id, admin_name: admin!.full_name, action: ap.is_active ? 'deactivate_admin' : 'activate_admin', entity_label: ap.full_name })
    toast(ap.is_active ? 'Admin deactivated.' : 'Admin activated.', 'success')
    load()
  }

  const handleInvite = async () => {
    if (!email.trim() || !fullName.trim()) { toast('Email and name are required.', 'warning'); return }
    setInviting(true)
    try {
      // Invite user via Supabase Auth
      const { data, error } = await supabase.auth.admin?.inviteUserByEmail?.(email) || { data: null, error: { message: 'Admin API not available from browser.' } }
      // Fallback: just insert profile and let user set password via Supabase dashboard
      // In production, use the Supabase dashboard to invite admins.
      toast('To create a new admin, please use the Supabase Dashboard → Authentication → Users → Invite User, then add their profile to termcat_admin_profiles.', 'info', 10000)
    } catch { toast('Invitation failed.', 'error') } finally { setInviting(false); setShowInvite(false) }
  }

  return (
    <SchoolConnectLayout systemTitle="System Administrators Master Data">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="page-title">Administrators</h1>
          <button className="btn-md btn-primary" onClick={() => setShowInvite(v => !v)}>
            <Plus size={16} /> Add Admin
          </button>
        </div>

        {showInvite && (
          <div className="card p-4 space-y-3 border-deped-blue/20 bg-deped-blue-light animate-fade-in">
            <h2 className="section-title text-deped-blue">Invite Administrator</h2>
            <p className="text-xs text-content-secondary">
              To create a new admin, use the Supabase Dashboard → Authentication → Users → Invite User.
              After the user accepts the invitation, insert a row in the <code>termcat_admin_profiles</code> table with their user ID.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label text-xs">Full Name</label><input className="form-input text-sm" value={fullName} onChange={e => setFullName(e.target.value)} /></div>
              <div><label className="form-label text-xs">Email</label><input type="email" className="form-input text-sm" value={email} onChange={e => setEmail(e.target.value)} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-sm btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
              <button className="btn-sm btn-primary" onClick={handleInvite} disabled={inviting}>
                {inviting ? 'Processing...' : 'Invite'}
              </button>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          {loading ? (
            <DepEdSpinner size="lg" label="Loading Platform Administrators..." subtitle="Fetching administrator accounts from Supabase" />
          ) : admins.length === 0 ? (
            <EmptyState title="No administrators" icon={<Shield size={28} />} />
          ) : (
            <div className="divide-y divide-surface-border">
              {admins.map(ap => (
                <div key={ap.id} className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                  <div>
                    <p className={`text-sm font-medium ${ap.is_active ? 'text-content-primary' : 'text-content-tertiary'}`}>
                      {ap.full_name}
                      {ap.id === admin?.id && <span className="ml-2 text-xs text-deped-blue">(You)</span>}
                    </p>
                    <p className="text-xs text-content-tertiary">{ap.email}</p>
                    <p className="text-xs text-content-tertiary">Joined {format(new Date(ap.created_at), 'MMM d, yyyy')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${ap.is_active ? 'text-deped-green' : 'text-content-tertiary'}`}>
                      {ap.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {ap.id !== admin?.id && (
                      <button
                        className={`btn-sm ${ap.is_active ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggleActive(ap)}
                      >
                        {ap.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SchoolConnectLayout>
  )
}
