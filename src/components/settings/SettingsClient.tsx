"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getInitials, AVATAR_COLORS } from "@/lib/utils"

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India (IST, UTC+5:30)" },
  { value: "Asia/Dubai", label: "Dubai (GST, UTC+4)" },
  { value: "Asia/Singapore", label: "Singapore (SGT, UTC+8)" },
  { value: "Asia/Tokyo", label: "Japan (JST, UTC+9)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Central Europe (CET, UTC+1)" },
  { value: "America/New_York", label: "New York (EST, UTC-5)" },
  { value: "America/Chicago", label: "Chicago (CST, UTC-6)" },
  { value: "America/Denver", label: "Denver (MST, UTC-7)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST, UTC-8)" },
  { value: "UTC", label: "UTC" },
]

type ProfileData = {
  id: string
  name: string
  email: string
  role: string
  avatar_color: string | null
  team_id: string | null
}

export function SettingsClient({
  profile: initialProfile,
  teamName: initialTeamName,
  timezone: initialTimezone,
  isAdmin,
}: {
  profile: ProfileData
  teamName: string
  timezone: string
  isAdmin: boolean
}) {
  // Profile form
  const [name, setName] = useState(initialProfile.name)
  const [avatarColor, setAvatarColor] = useState(initialProfile.avatar_color ?? AVATAR_COLORS[0])
  const [savingProfile, setSavingProfile] = useState(false)

  // Team form
  const [teamName, setTeamName] = useState(initialTeamName)
  const [newTeamName, setNewTeamName] = useState(initialTeamName)
  const [timezone, setTimezone] = useState(initialTimezone)
  const [savingTeam, setSavingTeam] = useState(false)

  // Change password form
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSavingProfile(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim(), avatar_color: avatarColor })
      .eq("id", initialProfile.id)
    if (error) { toast.error(error.message); setSavingProfile(false); return }
    toast.success("Profile updated")
    setSavingProfile(false)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) return
    if (newPassword !== confirmPassword) { toast.error("New passwords don't match"); return }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return }
    setSavingPassword(true)
    try {
      const supabase = createClient()
      // Verify current password by re-authenticating
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: initialProfile.email,
        password: currentPassword,
      })
      if (signInErr) { toast.error("Current password is incorrect"); return }
      // Update password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updateErr) { toast.error(updateErr.message); return }
      toast.success("Password updated successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } finally {
      setSavingPassword(false)
    }
  }

  async function saveTeamName(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamName.trim() || !initialProfile.team_id) return
    setSavingTeam(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("teams")
      .update({ name: newTeamName.trim(), timezone })
      .eq("id", initialProfile.team_id)
    if (error) { toast.error(error.message); setSavingTeam(false); return }
    setTeamName(newTeamName.trim())
    toast.success("Workspace settings saved")
    setSavingTeam(false)
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-[15px] font-semibold">Settings</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Manage your profile and workspace</p>
      </div>

      {/* Profile */}
      <form onSubmit={saveProfile} className="bg-card border border-border rounded-lg p-5 space-y-4">
        <p className="text-[13px] font-medium">Profile</p>

        {/* Preview */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold text-white shrink-0 transition-colors"
            style={{ backgroundColor: avatarColor }}
          >
            {getInitials(name || initialProfile.name)}
          </div>
          <div>
            <p className="text-[13px] font-medium">{name || initialProfile.name}</p>
            <p className="text-[11px] text-muted-foreground">{initialProfile.email}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Display name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            className="bg-secondary border-border text-[13px] h-8"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Avatar color
          </label>
          <div className="flex flex-wrap gap-2.5">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAvatarColor(c)}
                className="w-7 h-7 rounded-full transition-all"
                style={{
                  backgroundColor: c,
                  transform: avatarColor === c ? "scale(1.2)" : "scale(1)",
                  boxShadow: avatarColor === c ? `0 0 0 2px var(--card), 0 0 0 3.5px ${c}` : "none",
                }}
              />
            ))}
          </div>
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            size="sm"
            className="h-7 text-[12px]"
            disabled={savingProfile || (!name.trim() || (name.trim() === initialProfile.name && avatarColor === (initialProfile.avatar_color ?? AVATAR_COLORS[0])))}
          >
            {savingProfile ? "Saving..." : "Save profile"}
          </Button>
        </div>
      </form>

      {/* Team settings - admin only */}
      {isAdmin && (
        <form onSubmit={saveTeamName} className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div>
            <p className="text-[13px] font-medium">Workspace</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Visible to all team members in the sidebar.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Team name
            </label>
            <Input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Your team or company name"
              required
              className="bg-secondary border-border text-[13px] h-8"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-8 px-2 text-[13px] bg-secondary border border-border rounded-[5px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">
              Used for scheduling reminders and date calculations.
            </p>
          </div>

          <Button
            type="submit"
            size="sm"
            className="h-7 text-[12px]"
            disabled={savingTeam || !newTeamName.trim()}
          >
            {savingTeam ? "Saving..." : "Save workspace settings"}
          </Button>
        </form>
      )}

      {/* Account info (read-only) */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <p className="text-[13px] font-medium">Account</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">Email</span>
            <span className="text-[12px]">{initialProfile.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">Role</span>
            <span className={`text-[11px] font-medium capitalize px-2 py-0.5 rounded-full ${isAdmin
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-secondary text-muted-foreground border border-border"
              }`}>{initialProfile.role}</span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <form onSubmit={changePassword} className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div>
          <p className="text-[13px] font-medium">Change password</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Must be at least 8 characters.</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Current password
            </label>
            <div className="relative">
              <Input
                type={showCurrentPw ? "text" : "password"}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
                required
                className="bg-secondary border-border text-[13px] h-8 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showCurrentPw ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 2l12 12M6.5 6.6A2 2 0 0010 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    <path d="M3.5 4.6C2 5.6 1 7 1 8c0 1.5 3.1 5 7 5 1.4 0 2.8-.5 3.9-1.2M6 3.2C6.6 3.1 7.3 3 8 3c3.9 0 7 3.5 7 5 0 .7-.5 1.7-1.4 2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/>
                    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              New password
            </label>
            <div className="relative">
              <Input
                type={showNewPw ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
                className="bg-secondary border-border text-[13px] h-8 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showNewPw ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 2l12 12M6.5 6.6A2 2 0 0010 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    <path d="M3.5 4.6C2 5.6 1 7 1 8c0 1.5 3.1 5 7 5 1.4 0 2.8-.5 3.9-1.2M6 3.2C6.6 3.1 7.3 3 8 3c3.9 0 7 3.5 7 5 0 .7-.5 1.7-1.4 2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/>
                    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                )}
              </button>
            </div>
            {newPassword && newPassword.length < 8 && (
              <p className="text-[10px] text-destructive">Too short — needs 8+ characters</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Confirm new password
            </label>
            <div className="relative">
              <Input
                type={showConfirmPw ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                autoComplete="new-password"
                required
                className="bg-secondary border-border text-[13px] h-8 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showConfirmPw ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 2l12 12M6.5 6.6A2 2 0 0010 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    <path d="M3.5 4.6C2 5.6 1 7 1 8c0 1.5 3.1 5 7 5 1.4 0 2.8-.5 3.9-1.2M6 3.2C6.6 3.1 7.3 3 8 3c3.9 0 7 3.5 7 5 0 .7-.5 1.7-1.4 2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/>
                    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                )}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[10px] text-destructive">Passwords don&apos;t match</p>
            )}
          </div>
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            size="sm"
            className="h-7 text-[12px]"
            disabled={
              savingPassword ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword ||
              newPassword.length < 8 ||
              newPassword !== confirmPassword
            }
          >
            {savingPassword ? "Updating..." : "Update password"}
          </Button>
        </div>
      </form>
    </div>
  )
}
