import { useEffect, useState } from 'react'
import { supabase, uploadFile, BUCKETS } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAppSettings } from '../hooks/useAppSettings'
import { Card, Button, Input } from '../components/ui'

function ProfileSection() {
  const { profile, user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState(null)
  const [passwordSaved, setPasswordSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setPhone(profile.phone || '')
    }
  }, [profile])

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const path = `${user.id}/perfil_${Date.now()}_${file.name}`
      const url = await uploadFile(BUCKETS.PHOTOS, path, file)
      await supabase.from('profiles').update({ photo_url: url }).eq('id', user.id)
      window.location.reload() // simples: recarrega para refletir a nova foto no contexto
    } catch (err) {
      console.error('Erro ao enviar foto:', err)
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true)
    setProfileSaved(false)
    try {
      await supabase.from('profiles').update({ full_name: fullName, phone: phone || null }).eq('id', user.id)
      setProfileSaved(true)
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError(null)
    setPasswordSaved(false)
    if (newPassword.length < 6) {
      setPasswordError('A password deve ter pelo menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As passwords não coincidem.')
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSaved(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err.message || 'Não foi possível mudar a password.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display font-medium text-ink">O meu perfil</h2>

      <Card className="space-y-4">
        <div className="flex items-center gap-4">
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt="" className="w-14 h-14 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-panel2 border border-border flex items-center justify-center text-muted text-lg font-display">
              {fullName?.[0] || '?'}
            </div>
          )}
          <label className="text-xs text-cyan cursor-pointer hover:underline">
            {uploadingPhoto ? 'A enviar...' : 'Mudar foto'}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
          </label>
        </div>

        <Input label="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Email" value={profile?.email || ''} disabled className="opacity-60" />

        <div className="flex items-center gap-3">
          <Button onClick={handleSaveProfile} disabled={savingProfile}>{savingProfile ? 'A guardar...' : 'Guardar perfil'}</Button>
          {profileSaved && <span className="text-ok text-xs">✓ Guardado</span>}
        </div>
      </Card>

      <Card className="space-y-4">
        <p className="text-sm text-ink font-medium">Mudar password</p>
        <Input label="Nova password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <Input label="Confirmar nova password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        {passwordError && <p className="text-alert text-sm">{passwordError}</p>}
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleChangePassword} disabled={savingPassword}>
            {savingPassword ? 'A mudar...' : 'Mudar password'}
          </Button>
          {passwordSaved && <span className="text-ok text-xs">✓ Password alterada</span>}
        </div>
      </Card>
    </div>
  )
}

function OrgSettingsSection() {
  const { settings, loading, refresh } = useAppSettings()
  const { user } = useAuth()
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setForm(settings) }, [settings])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await supabase
        .from('app_settings')
        .update({
          cert_expiry_warning_days: Number(form.cert_expiry_warning_days),
          maintenance_warning_days: Number(form.maintenance_warning_days),
          wind_gust_limit_ms: Number(form.wind_gust_limit_ms),
          battery_max_cycles: Number(form.battery_max_cycles),
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', 'default')
      await refresh()
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-muted text-sm">A carregar...</p>

  return (
    <div className="space-y-4">
      <h2 className="font-display font-medium text-ink">Definições da organização</h2>
      <p className="text-muted text-xs -mt-2">
        Estes valores controlam quando os alertas disparam e como certos cálculos são feitos em toda a app.
      </p>

      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Aviso de habilitação a expirar (dias)"
            type="number"
            min="1"
            value={form.cert_expiry_warning_days}
            onChange={(e) => setForm((f) => ({ ...f, cert_expiry_warning_days: e.target.value }))}
          />
          <Input
            label="Aviso de manutenção próxima (dias)"
            type="number"
            min="1"
            value={form.maintenance_warning_days}
            onChange={(e) => setForm((f) => ({ ...f, maintenance_warning_days: e.target.value }))}
          />
          <Input
            label="Limite de rajada de vento (m/s)"
            type="number"
            min="0"
            step="0.5"
            value={form.wind_gust_limit_ms}
            onChange={(e) => setForm((f) => ({ ...f, wind_gust_limit_ms: e.target.value }))}
          />
          <Input
            label="Ciclos máximos de bateria (estimativa de saúde)"
            type="number"
            min="1"
            value={form.battery_max_cycles}
            onChange={(e) => setForm((f) => ({ ...f, battery_max_cycles: e.target.value }))}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>{saving ? 'A guardar...' : 'Guardar definições'}</Button>
          {saved && <span className="text-ok text-xs">✓ Guardado — aplica-se de imediato em toda a app</span>}
        </div>
      </Card>
    </div>
  )
}

export default function Settings() {
  const { isAdminOrManager } = useAuth()

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="font-display text-xl font-semibold text-ink">Configurações</h1>
      <ProfileSection />
      {isAdminOrManager && <OrgSettingsSection />}
    </div>
  )
}
