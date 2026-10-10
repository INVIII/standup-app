"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { getInitials } from "@/lib/utils"
import type { Profile } from "@/types/database"

type Member = Profile & { team_name?: string | null; role_name?: string | null }

type InviteRecord = {
  id: string
  email: string | null
  token: string
  created_at: string
  expires_at: string
  used_at: string | null
}

const TEAM_GROUPS = ["Frontend", "Backend", "Design", "Mobile", "DevOps", "QA", "Product", "AI", "Data", "Other"]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/* ── Inline editable field (admin only) ────────────── */
function EditableField({
  value, placeholder, onSave,
}: {
  value: string | null | undefined
  placeholder: string
  onSave: (v: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? "")
  const [saving, setSaving] = useState(false)

  useState(() => { setVal(value ?? "") })

  async function submit() {
    setSaving(true)
    await onSave(val.trim())
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <form onSubmit={e => { e.preventDefault(); submit() }} className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          className="h-5 px-1.5 text-[11px] bg-background border border-primary/40 rounded-[3px] w-28 focus:outline-none"
        />
        <button type="submit" disabled={saving} className="text-[10px] text-primary">
          {saving ? "…" : "✓"}
        </button>
        <button type="button" onClick={() => { setEditing(false); setVal(value ?? "") }}
          className="text-[10px] text-muted-foreground">✕</button>
      </form>
    )
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      className="text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors text-left"
    >
      {value || <span className="text-muted-foreground/40 italic">{placeholder}</span>}
    </button>
  )
}

/* ── Member card ─────────────────────────────────────── */
function MemberCard({
  member, isAdmin, isSelf, onUpdate, onToggleRole, onToggleActive, onRemove,
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
    <div className="border border-border rounded-[6px] overflow-hidden">
      <div
        className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${isAdmin ? "hover:bg-secondary/20 cursor-pointer" : ""}`}
        onClick={() => isAdmin && setExpanded(e => !e)}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
          style={{ backgroundColor: member.avatar_color ?? "#5e6ad2" }}
        >
          {getInitials(member.name)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-medium truncate">{member.name}</p>
            {isSelf && (
              <span className="text-[9px] text-muted-foreground/50 border border-border px-1.5 py-0.5 rounded-full shrink-0">you</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
        </div>

        {member.role_name && (
          <span className="text-[10px] text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-full hidden sm:block shrink-0">
            {member.role_name}
          </span>
        )}

        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
          member.role === "admin"
            ? "bg-primary/10 text-primary border border-primary/20"
            : "bg-secondary text-muted-foreground border border-border"
        }`}>
          {member.role}
        </span>

        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${member.is_active ? "bg-[#26d97f]" : "bg-muted-foreground/30"}`} />

        {isAdmin && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`text-muted-foreground/30 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}>
            <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

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
            <button onClick={() => onToggleRole(member)} disabled={isSelf}
              className="text-[11px] text-muted-foreground hover:text-foreground border border-border px-2.5 py-1 rounded-[5px] hover:bg-secondary transition-colors disabled:opacity-30">
              Make {member.role === "admin" ? "member" : "admin"}
            </button>
            <button onClick={() => onToggleActive(member)} disabled={isSelf}
              className="text-[11px] text-muted-foreground hover:text-foreground border border-border px-2.5 py-1 rounded-[5px] hover:bg-secondary transition-colors disabled:opacity-30">
              {member.is_active ? "Deactivate" : "Activate"}
            </button>
            {!isSelf && (
              <button onClick={() => onRemove(member)}
                className="text-[11px] text-muted-foreground hover:text-red-400 border border-border hover:border-red-400/40 px-2.5 py-1 rounded-[5px] transition-colors ml-auto">
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Team group ─────────────────────────────────────── */
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
      <button onClick={() => setCollapsed(c => !c)} className="flex items-center gap-2 w-full mb-2">
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

/* ── Invite section (admin only) ────────────────────── */
function InviteSection({ initialInvites, memberEmails }: { initialInvites: InviteRecord[], memberEmails: Set<string> }) {
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const [justSent, setJustSent] = useState<{ email: string; link: string; alreadyExists?: boolean } | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [genericLink, setGenericLink] = useState("")
  const [genericCopied, setGenericCopied] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [invites, setInvites] = useState<InviteRecord[]>(initialInvites)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [resending, setResending] = useState<string | null>(null)
  const [pendingOpen, setPendingOpen] = useState(false)
  const [acceptedOpen, setAcceptedOpen] = useState(false)

  const now = new Date()
  const accepted = invites.filter(i => !!i.used_at && !!i.email && memberEmails.has(i.email!))
  const acceptedEmails = new Set(accepted.map(i => i.email))
  const pendingRaw = invites.filter(
    i => !i.used_at && new Date(i.expires_at) > now && !!i.email && !acceptedEmails.has(i.email)
  )
  const pendingByEmail = new Map<string, InviteRecord>()
  for (const inv of pendingRaw) {
    const existing = pendingByEmail.get(inv.email!)
    if (!existing || new Date(inv.created_at) > new Date(existing.created_at)) {
      pendingByEmail.set(inv.email!, inv)
    }
  }
  const pending = Array.from(pendingByEmail.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  async function sendEmailInvite(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = inviteEmail.trim()
    if (!trimmed) return

    setInviting(true)
    setJustSent(null)
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to send invite")

      const link = `${window.location.origin}/join/${data.token}`

      if (data.alreadyExists) {
        setJustSent({ email: trimmed, link, alreadyExists: true })
        toast.info(`${trimmed} already has a pending invite — link copied below`)
      } else {
        // Add to local list
        setInvites(prev => [{
          id: data.invite?.id ?? Date.now().toString(),
          email: trimmed,
          token: data.token,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          used_at: null,
        }, ...prev])
        setJustSent({ email: trimmed, link })
        toast.success(
          data.emailSent
            ? `Invite sent to ${trimmed}`
            : `Invite created for ${trimmed} — email may not have arrived, use the link below`
        )
      }
      setInviteEmail("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
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
      setGenericLink(`${window.location.origin}/join/${data.token}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setGeneratingLink(false)
    }
  }

  async function copyLink(link: string, token: string) {
    await navigator.clipboard.writeText(link)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  async function handleRevoke(invite: InviteRecord) {
    setRevoking(invite.token)
    try {
      const res = await fetch(`/api/invite?token=${invite.token}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to revoke")
      setInvites(prev =>
        invite.email
          ? prev.filter(i => i.email !== invite.email || !!i.used_at)
          : prev.filter(i => i.token !== invite.token)
      )
      if (invite.email) setJustSent(prev => prev?.email === invite.email ? null : prev)
      toast.success("Invite revoked")
    } catch {
      toast.error("Failed to revoke invite")
    } finally {
      setRevoking(null)
    }
  }

  async function handleResend(invite: InviteRecord) {
    setResending(invite.token)
    try {
      const res = await fetch("/api/invite/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invite.token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")

      setInvites(prev => prev.map(i =>
        i.token === invite.token
          ? { ...i, token: data.token, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }
          : i
      ))

      try {
        await navigator.clipboard.writeText(data.link)
        toast.success(data.emailSent ? "Invite resent and link copied" : "New link copied")
      } catch {
        toast.success(
          data.emailSent
            ? `Invite resent! Link: ${data.link}`
            : `Link generated: ${data.link}`,
          { duration: 8000 }
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate link")
    } finally {
      setResending(null)
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[13px] font-medium">Invite members</p>
      </div>

      {/* ── Send via email ── */}
      <div className="px-4 py-3 border-b border-border space-y-2.5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Send via email</p>
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

        {/* Show link right after sending */}
        {justSent && (
          <div className="rounded-[5px] border border-border bg-secondary/50 px-3 py-2.5 space-y-1.5">
            <p className="text-[11px] text-muted-foreground">
              {justSent.alreadyExists
                ? `${justSent.email} already has a pending invite — share this link:`
                : `Invite link for ${justSent.email} (share this if email didn't arrive):`}
            </p>
            <div className="flex gap-2">
              <div className="flex-1 font-mono text-[10px] text-muted-foreground bg-background border border-border rounded-[4px] px-2 py-1 truncate">
                {justSent.link}
              </div>
              <button
                onClick={async () => { await navigator.clipboard.writeText(justSent.link); toast.success("Copied!") }}
                className="h-7 px-2.5 text-[11px] bg-primary text-primary-foreground rounded-[4px] hover:bg-primary/90 shrink-0 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Generic invite link ── */}
      <div className="px-4 py-3 border-b border-border space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Generic invite link</p>
        {genericLink ? (
          <div className="flex gap-2">
            <div className="flex-1 bg-secondary border border-border rounded-[5px] px-3 py-1.5 text-[11px] text-muted-foreground font-mono truncate">
              {genericLink}
            </div>
            <button
              onClick={async () => { await navigator.clipboard.writeText(genericLink); setGenericCopied(true); setTimeout(() => setGenericCopied(false), 2000) }}
              className={`h-8 px-3 text-[12px] rounded-[5px] border transition-colors shrink-0 ${genericCopied ? "bg-primary text-primary-foreground border-transparent" : "border-border hover:bg-secondary"}`}
            >
              {genericCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        ) : (
          <button onClick={generateLink} disabled={generatingLink}
            className="h-8 px-3 text-[12px] border border-border rounded-[5px] hover:bg-secondary disabled:opacity-50 transition-colors">
            {generatingLink ? "Generating…" : "Generate link"}
          </button>
        )}
        <p className="text-[10px] text-muted-foreground/50">Valid for 7 days · Anyone with the link can join</p>
      </div>

      {/* ── Pending invites (collapsible) ── */}
      {pending.length > 0 && (
        <div className="border-t border-border">
          <button
            onClick={() => setPendingOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/30 transition-colors text-left"
          >
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={`text-muted-foreground/40 transition-transform shrink-0 ${pendingOpen ? "" : "-rotate-90"}`}
            >
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Pending</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#f5a524]/15 text-[#f5a524]">{pending.length}</span>
          </button>

          {pendingOpen && (
            <div className="px-4 pb-3 space-y-1.5">
              {pending.map(invite => {
                const link = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${invite.token}`
                const isCopied = copiedToken === invite.token
                const isRevoking = revoking === invite.token
                const isResending = resending === invite.token

                return (
                  <div key={invite.token} className="flex items-center gap-2 py-1.5 px-2.5 rounded-[5px] bg-secondary/40 border border-border/60">
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-muted-foreground/40 shrink-0">
                      <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M1 4.5L7 8.5L13 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    <span className="text-[12px] flex-1 truncate">{invite.email}</span>
                    <span className="text-[10px] text-muted-foreground/40 shrink-0">{timeAgo(invite.created_at)}</span>
                    <button
                      onClick={() => copyLink(link, invite.token)}
                      className={`text-[10px] px-2 py-0.5 rounded-[4px] border transition-colors shrink-0 ${isCopied ? "bg-primary/10 text-primary border-primary/20" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                    >
                      {isCopied ? "Copied!" : "Copy link"}
                    </button>
                    <button
                      onClick={() => handleResend(invite)}
                      disabled={!!isResending}
                      className="text-[10px] px-2 py-0.5 rounded-[4px] border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40 shrink-0"
                    >
                      {isResending ? "…" : "Resend"}
                    </button>
                    <button
                      onClick={() => handleRevoke(invite)}
                      disabled={!!isRevoking}
                      className="text-[10px] px-2 py-0.5 rounded-[4px] border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-40 shrink-0"
                    >
                      {isRevoking ? "…" : "Revoke"}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Accepted (collapsible) ── */}
      {accepted.length > 0 && (
        <div className="border-t border-border">
          <button
            onClick={() => setAcceptedOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/30 transition-colors text-left"
          >
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={`text-muted-foreground/40 transition-transform shrink-0 ${acceptedOpen ? "" : "-rotate-90"}`}
            >
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Accepted</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#26d97f]/15 text-[#26d97f]">{accepted.length}</span>
          </button>

          {acceptedOpen && (
            <div className="px-4 pb-3 space-y-0.5">
              {accepted.map(invite => (
                <div key={invite.token} className="flex items-center gap-2 px-2 py-1.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#26d97f] shrink-0">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[12px] flex-1 truncate text-muted-foreground">{invite.email}</span>
                  <span className="text-[10px] text-muted-foreground/40 shrink-0">
                    {invite.used_at ? timeAgo(invite.used_at) : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Main ───────────────────────────────────────────── */
export function TeamPageClient({
  initialMembers,
  initialInvites,
  isAdmin,
  currentUserId,
}: {
  initialMembers: Member[]
  initialInvites: InviteRecord[]
  isAdmin: boolean
  currentUserId: string
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  async function updateMember(id: string, patch: Partial<Member>) {
    // Use the server API so the service role key bypasses RLS (admin updating another user's row)
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
    const res = await fetch(`/api/profiles/${member.id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }))
      toast.error(err.error ?? "Failed to remove member")
      setRemoving(false)
      return
    }
    setMembers(prev => prev.filter(m => m.id !== member.id))
    setConfirmRemoveId(null)
    toast.success(`${member.name} removed`)
    setRemoving(false)
  }

  // Group by team_name
  const grouped: [string, Member[]][] = (() => {
    const groups: Record<string, Member[]> = {}
    for (const m of members) {
      const g = m.team_name?.trim() || "No team"
      if (!groups[g]) groups[g] = []
      groups[g].push(m)
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "No team") return 1
      if (b === "No team") return -1
      return a.localeCompare(b)
    })
  })()

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-[15px] font-semibold">Team</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {members.filter(m => m.is_active).length} active members
        </p>
      </div>

      {isAdmin && <InviteSection initialInvites={initialInvites} memberEmails={new Set(members.map(m => m.email))} />}

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Organisation</p>
          {isAdmin && (
            <p className="text-[10px] text-muted-foreground/50">Click a member to edit their team &amp; role</p>
          )}
        </div>

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
                <button onClick={() => setConfirmRemoveId(null)}
                  className="flex-1 h-8 text-[13px] border border-border rounded-[6px] hover:bg-secondary transition-colors">
                  Cancel
                </button>
                <button onClick={() => removeMember(m)} disabled={removing}
                  className="flex-1 h-8 text-[13px] bg-red-500/10 text-red-400 border border-red-500/30 rounded-[6px] hover:bg-red-500/20 transition-colors disabled:opacity-50">
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
