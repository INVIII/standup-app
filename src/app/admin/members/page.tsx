"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { getInitials } from "@/lib/utils"
import type { Profile } from "@/types/database"

/* ── Types ────────────────────────────────────────── */

type Member = Profile & { team_name?: string | null; role_name?: string | null }

const TEAM_GROUPS = ["Frontend", "Backend", "Design", "Mobile", "DevOps", "QA", "Product", "Other"]

/* ── Inline editable field (admin only) ────────────── */
function EditableField({
  value,
  placeholder,
  onSave,
}: {
  value: string | null | undefined
  placeholder: string
  onSave: (v: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? "")
  const [saving, setSaving] = useState(false)

  // Re-sync when the parent value changes (switching between members)
  useEffect(() => { setVal(value ?? "") }, [value])

  async function submit() {
    setSaving(true)
    await onSave(val.trim())
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <form
        onSubmit={e => { e.preventDefault(); submit() }}
        className="flex items-center gap-1"
        onClick={e => e.stopPropagation()}
      >
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          className="h-5 px-1.5 text-[11px] bg-background border border-primary/40 rounded-[3px] w-24 focus:outline-none"
        />
        <button type="submit" disabled={saving} className="text-[10px] text-primary hover:text-primary/80">
          {saving ? "…" : "✓"}
        </button>
        <button type="button" onClick={() => { setEditing(false); setVal(value ?? "") }} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
      </form>
    )
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      className="text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
    >
      {value || <span className="text-muted-foreground/40 italic">{placeholder}</span>}
    </button>
  )
}

/* ── Member card ────────────────────────────────────── */
function MemberCard({
  member,
  isAdmin,
  isSelf,
  onUpdate,
  onToggleRole,
  onToggleActive,
  onRemove,
}: {
  member: Member
  isAdmin: boolean
  isSelf: boolean
  onUpdate: (id: string, patch: Partial<Member>) => Promise<void>
  onToggleRole: (m: Member) => Promise<void>
  onToggleActive: (m: Member) => void
  onRemove: (m: Member) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-border rounded-[6px] overflow-hidden hover:border-border/80 transition-colors">
      <div
        className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/20 transition-colors cursor-pointer"
        onClick={() => isAdmin && setExpanded(e => !e)}
      >
        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
          style={{ backgroundColor: member.avatar_color ?? "#5e6ad2" }}
        >
          {getInitials(member.name)}
        </div>

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-medium truncate">{member.name}</p>
            {isSelf && (
              <span className="text-[9px] text-muted-foreground/50 border border-border px-1.5 py-0.5 rounded-full">you</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
        </div>

        {/* Role title badge */}
        {member.role_name && (
          <span className="text-[10px] text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-full hidden sm:block shrink-0">
            {member.role_name}
          </span>
        )}

        {/* System role badge */}
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${member.role === "admin"
            ? "bg-primary/10 text-primary border border-primary/20"
            : "bg-secondary text-muted-foreground border border-border"
          }`}>
          {member.role}
        </span>

        {/* Active dot */}
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${member.is_active ? "bg-[#26d97f]" : "bg-muted-foreground/30"}`} />

        {isAdmin && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`text-muted-foreground/30 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}>
            <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Admin expanded panel */}
      {isAdmin && expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-border bg-secondary/10 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Role title</p>
              <EditableField
                value={member.role_name}
                placeholder="e.g. Senior Dev"
                onSave={v => onUpdate(member.id, { role_name: v || null })}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Team</p>
              <select
                value={member.team_name ?? ""}
                onChange={e => onUpdate(member.id, { team_name: e.target.value || null })}
                className="h-6 px-1.5 text-[11px] bg-secondary border border-border rounded-[3px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                onClick={e => e.stopPropagation()}
              >
                <option value="">No team</option>
                {TEAM_GROUPS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={() => onToggleRole(member)}
              disabled={isSelf}
              className="text-[11px] text-muted-foreground hover:text-foreground border border-border px-2.5 py-1 rounded-[5px] transition-colors hover:bg-secondary disabled:opacity-30"
            >
              Make {member.role === "admin" ? "member" : "admin"}
            </button>
            <button
              onClick={() => onToggleActive(member)}
              disabled={isSelf}
              className="text-[11px] text-muted-foreground hover:text-foreground border border-border px-2.5 py-1 rounded-[5px] transition-colors hover:bg-secondary disabled:opacity-30"
            >
              {member.is_active ? "Deactivate" : "Activate"}
            </button>
            {!isSelf && (
              <button
                onClick={() => onRemove(member)}
                className="text-[11px] text-muted-foreground hover:text-red-400 border border-border hover:border-red-400/40 px-2.5 py-1 rounded-[5px] transition-colors ml-auto"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Team group section ─────────────────────────────── */
function TeamGroup({
  groupName, members, isAdmin, currentUserId, onUpdate, onToggleRole, onToggleActive, onRemove,
}: {
  groupName: string
  members: Member[]
  isAdmin: boolean
  currentUserId: string | null
  onUpdate: (id: string, patch: Partial<Member>) => Promise<void>
  onToggleRole: (m: Member) => Promise<void>
  onToggleActive: (m: Member) => void
  onRemove: (m: Member) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 w-full mb-2 group"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`text-muted-foreground/40 transition-transform ${collapsed ? "-rotate-90" : ""}`}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{groupName}</span>
        <span className="text-[10px] text-muted-foreground/40">{members.length}</span>
      </button>
      {!collapsed && (
        <div className="space-y-1.5 pl-4">
          {members.map(m => (
            <MemberCard
              key={m.id}
              member={m}
              isAdmin={isAdmin}
              isSelf={m.id === currentUserId}
              onUpdate={onUpdate}
              onToggleRole={onToggleRole}
              onToggleActive={onToggleActive}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Invite section (admin only) ─────────────────────── */
function InviteSection() {
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState("")
  const [generatingLink, setGeneratingLink] = useState(false)
  const [copied, setCopied] = useState(false)

  async function sendEmailInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to send invite")
      toast.success(`Invite sent to ${inviteEmail}`)
      setInviteLink(`${window.location.origin}/join/${data.token}`)
      setInviteEmail("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite")
    } finally {
      setInviting(false)
    }
  }

  async function generateLink() {
    setGeneratingLink(true)
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setInviteLink(`${window.location.origin}/join/${data.token}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setGeneratingLink(false)
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <p className="text-[13px] font-medium">Invite members</p>
      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Send via email</p>
        <form onSubmit={sendEmailInvite} className="flex gap-2">
          <input
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            required
            className="flex-1 h-8 px-3 text-[13px] bg-secondary border border-border rounded-[5px] focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
          />
          <button type="submit" disabled={inviting}
            className="h-8 px-3 text-[12px] bg-primary text-primary-foreground rounded-[5px] hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0">
            {inviting ? "Sending…" : "Send"}
          </button>
        </form>
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Share invite link</p>
        {inviteLink ? (
          <div className="flex gap-2">
            <div className="flex-1 bg-secondary border border-border rounded-[5px] px-3 py-1.5 text-[11px] text-muted-foreground font-mono truncate">
              {inviteLink}
            </div>
            <button
              onClick={copyLink}
              className={`h-8 px-3 text-[12px] rounded-[5px] border transition-colors shrink-0 ${copied ? "bg-primary text-primary-foreground border-transparent" : "border-border hover:bg-secondary"
                }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        ) : (
          <button
            onClick={generateLink}
            disabled={generatingLink}
            className="h-8 px-3 text-[12px] border border-border rounded-[5px] hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            {generatingLink ? "Generating…" : "Generate invite link"}
          </button>
        )}
        <p className="text-[10px] text-muted-foreground/50 mt-1.5">Valid for 7 days · Anyone with the link can join your team</p>
      </div>
    </div>
  )
}

/* ── Main page ──────────────────────────────────────── */

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      const { data: profile } = await supabase.from("profiles").select("team_id, role").eq("id", user.id).single()
      if (!profile?.team_id) return
      setIsAdmin(profile.role === "admin")
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("team_id", profile.team_id)
        .order("name")
      setMembers((data ?? []) as Member[])
      setLoading(false)
    }
    load()
  }, [])

  async function updateMember(id: string, patch: Partial<Member>) {
    const res = await fetch(`/api/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }))
      toast.error(err.error ?? "Failed to update member")
      return
    }
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  async function toggleRole(member: Member) {
    if (member.id === currentUserId) { toast.error("Cannot change your own role"); return }
    const newRole = member.role === "admin" ? "member" : "admin"
    await updateMember(member.id, { role: newRole })
    toast.success(`${member.name} is now ${newRole}`)
  }

  function toggleActive(member: Member) {
    const admins = members.filter(m => m.role === "admin" && m.is_active)
    if (member.role === "admin" && member.is_active && admins.length <= 1) {
      toast.error("Cannot deactivate the last admin"); return
    }
    updateMember(member.id, { is_active: !member.is_active })
  }

  async function removeMember(member: Member) {
    const admins = members.filter(m => m.role === "admin" && m.is_active)
    if (member.role === "admin" && admins.length <= 1) {
      toast.error("Cannot remove the last admin"); return
    }
    setRemoving(true)
    const supabase = createClient()
    const { error } = await supabase.from("profiles").update({ team_id: null, is_active: false }).eq("id", member.id)
    if (error) { toast.error(error.message); setRemoving(false); return }
    setMembers(prev => prev.filter(m => m.id !== member.id))
    setConfirmRemoveId(null)
    toast.success(`${member.name} removed`)
    setRemoving(false)
  }

  // Group members by team_name
  const grouped = (() => {
    const groups: Record<string, Member[]> = {}
    for (const m of members) {
      const g = m.team_name?.trim() || "No team"
      if (!groups[g]) groups[g] = []
      groups[g].push(m)
    }
    // Sort: named groups first alphabetically, then "No team"
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "No team") return 1
      if (b === "No team") return -1
      return a.localeCompare(b)
    })
  })()

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold">Team</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {members.filter(m => m.is_active).length} active members
          </p>
        </div>
      </div>

      {/* Invite - admin only */}
      {isAdmin && <InviteSection />}

      {/* Team hierarchy */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Organisation
          </p>
          {isAdmin && (
            <p className="text-[10px] text-muted-foreground/50">Click a member to edit their team & role</p>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-11 bg-card border border-border rounded-[6px] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([groupName, groupMembers]) => (
              <TeamGroup
                key={groupName}
                groupName={groupName}
                members={groupMembers}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                onUpdate={updateMember}
                onToggleRole={toggleRole}
                onToggleActive={toggleActive}
                onRemove={m => setConfirmRemoveId(m.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm remove modal */}
      {confirmRemoveId && (() => {
        const m = members.find(x => x.id === confirmRemoveId)
        if (!m) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm shadow-xl space-y-3">
              <p className="text-[14px] font-semibold">Remove member?</p>
              <p className="text-[13px] text-muted-foreground">
                <span className="text-foreground font-medium">{m.name}</span> will lose access immediately.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setConfirmRemoveId(null)}
                  className="flex-1 h-8 text-[13px] border border-border rounded-[6px] hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => removeMember(m)}
                  disabled={removing}
                  className="flex-1 h-8 text-[13px] bg-red-500/10 text-red-400 border border-red-500/30 rounded-[6px] hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {removing ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
