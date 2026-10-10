"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { Release, Issue } from "@/types/database"
import { IssueTypeIcon } from "./IssueTypeBadge"

/* ── types ─────────────────────────────────────── */

interface ReleaseWithIssues extends Omit<Release, "release_issues"> {
  release_issues: { issue_id: string }[]
}

/* ── Status badge ───────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  unreleased: "bg-[#5e6ad220] text-[#5e6ad2]",
  released: "bg-[#26d97f20] text-[#26d97f]",
  archived: "bg-muted text-muted-foreground",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", STATUS_STYLES[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  )
}

/* ── Create / Edit modal ───────────────────────── */

function ReleaseModal({
  boardId,
  initial,
  onSave,
  onClose,
}: {
  boardId: string
  initial?: Partial<Release>
  onSave: (r: Release) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [version, setVersion] = useState(initial?.version ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [releaseDate, setReleaseDate] = useState(initial?.release_date?.slice(0, 10) ?? "")
  const [status, setStatus] = useState<Release["status"]>(initial?.status ?? "unreleased")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Name is required"); return }
    setLoading(true)
    try {
      const method = initial?.id ? "PATCH" : "POST"
      const body = initial?.id
        ? { id: initial.id, name, version, description, status, release_date: releaseDate || null }
        : { board_id: boardId, name, version, description, status, release_date: releaseDate || null }
      const res = await fetch("/api/releases", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed"); return }
      onSave(data)
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-[14px] font-semibold">{initial?.id ? "Edit Release" : "New Release"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {error && <p className="text-[12px] text-destructive">{error}</p>}
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Name *</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md px-3 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="v1.0.0 Release"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Version</label>
              <input
                value={version} onChange={e => setVersion(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="1.0.0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Release Date</label>
              <input
                type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          {initial?.id && (
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Status</label>
              <select
                value={status} onChange={e => setStatus(e.target.value as Release["status"])}
                className="w-full bg-secondary border border-border rounded-md px-3 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="unreleased">Unreleased</option>
                <option value="released">Released</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Description</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-secondary border border-border rounded-md px-3 py-1.5 text-[13px] text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="What's in this release?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-[12px] rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-3 py-1.5 text-[12px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Issue picker ───────────────────────────────── */

function IssuePickerModal({
  release,
  allIssues,
  onClose,
  onToggle,
}: {
  release: ReleaseWithIssues
  allIssues: Issue[]
  onClose: () => void
  onToggle: (issueId: string, add: boolean) => void
}) {
  const [q, setQ] = useState("")
  const linked = new Set(release.release_issues.map(ri => ri.issue_id))
  const filtered = allIssues.filter(i =>
    i.title.toLowerCase().includes(q.toLowerCase()) ||
    String(i.issue_number).includes(q)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-[14px] font-semibold">Manage Issues - {release.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-3">
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search issues…"
            className="w-full bg-secondary border border-border rounded-md px-3 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="max-h-[340px] overflow-y-auto space-y-1 pr-1">
            {filtered.length === 0 && (
              <p className="text-[12px] text-muted-foreground text-center py-6">No issues found.</p>
            )}
            {filtered.map(issue => {
              const isLinked = linked.has(issue.id)
              const board = (issue as any).board
              return (
                <div
                  key={issue.id}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors",
                    isLinked ? "bg-[#5e6ad215] hover:bg-[#5e6ad225]" : "hover:bg-accent"
                  )}
                  onClick={() => onToggle(issue.id, !isLinked)}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                    isLinked ? "bg-primary border-primary" : "border-border"
                  )}>
                    {isLinked && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <IssueTypeIcon type={issue.type} size={13} />
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {board?.key ?? ""}-{issue.issue_number}
                  </span>
                  <span className="text-[12px] truncate">{issue.title}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button onClick={onClose}
            className="px-3 py-1.5 text-[12px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Release card ───────────────────────────────── */

function ReleaseCard({
  release,
  allIssues,
  isAdmin,
  onUpdate,
  onDelete,
}: {
  release: ReleaseWithIssues
  allIssues: Issue[]
  isAdmin: boolean
  onUpdate: (r: ReleaseWithIssues) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [managingIssues, setManagingIssues] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const linkedIssueIds = new Set(release.release_issues.map(ri => ri.issue_id))
  const linkedIssues = allIssues.filter(i => linkedIssueIds.has(i.id))

  async function handleToggleIssue(issueId: string, add: boolean) {
    await fetch("/api/releases", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: release.id, issue_id: issueId, remove_issue: !add }),
    })
    const updated: ReleaseWithIssues = {
      ...release,
      release_issues: add
        ? [...release.release_issues, { issue_id: issueId }]
        : release.release_issues.filter(ri => ri.issue_id !== issueId),
    }
    onUpdate(updated)
  }

  async function handleDelete() {
    if (!confirm(`Delete release "${release.name}"?`)) return
    setDeleting(true)
    await fetch(`/api/releases?id=${release.id}`, { method: "DELETE" })
    onDelete(release.id)
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-4 py-3">
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className={cn("w-4 h-4 transition-transform", expanded && "rotate-90")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-semibold">{release.name}</span>
              {release.version && (
                <span className="text-[10px] font-mono bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded">
                  v{release.version}
                </span>
              )}
              <StatusBadge status={release.status} />
            </div>
            {release.description && (
              <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{release.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {release.release_date && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(release.release_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Kolkata" })}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">
                {linkedIssues.length} issue{linkedIssues.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setManagingIssues(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors"
              >
                Issues
              </button>
              <button
                onClick={() => setEditing(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[11px] text-muted-foreground hover:text-destructive px-2 py-1 rounded hover:bg-accent transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Expanded issue list */}
        {expanded && (
          <div className="border-t border-border px-4 py-2 space-y-1 bg-muted/20">
            {linkedIssues.length === 0 ? (
              <p className="text-[12px] text-muted-foreground py-3 text-center">
                No issues linked.{isAdmin && ' Click "Issues" to add some.'}
              </p>
            ) : (
              linkedIssues.map(issue => {
                const board = (issue as any).board
                return (
                  <div key={issue.id} className="flex items-center gap-2.5 py-1.5 text-[12px]">
                    <IssueTypeIcon type={issue.type} size={13} />
                    <span className="text-muted-foreground shrink-0">{board?.key ?? ""}-{issue.issue_number}</span>
                    <span className="truncate">{issue.title}</span>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {editing && (
        <ReleaseModal
          boardId={release.board_id}
          initial={release}
          onSave={r => { onUpdate({ ...release, ...r }); setEditing(false) }}
          onClose={() => setEditing(false)}
        />
      )}

      {managingIssues && (
        <IssuePickerModal
          release={release}
          allIssues={allIssues}
          onClose={() => setManagingIssues(false)}
          onToggle={handleToggleIssue}
        />
      )}
    </>
  )
}

/* ── Main ────────────────────────────────────────── */

export function ReleasesView({
  boardId,
  releases: initialReleases,
  allIssues,
  isAdmin,
}: {
  boardId: string
  releases: ReleaseWithIssues[]
  allIssues: Issue[]
  isAdmin: boolean
}) {
  const [releases, setReleases] = useState<ReleaseWithIssues[]>(initialReleases)
  const [creating, setCreating] = useState(false)

  function handleCreate(r: Release) {
    setReleases(prev => [{ ...r, release_issues: [] }, ...prev])
    setCreating(false)
  }

  function handleUpdate(updated: ReleaseWithIssues) {
    setReleases(prev => prev.map(r => r.id === updated.id ? updated : r))
  }

  function handleDelete(id: string) {
    setReleases(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">Releases</h2>
        {isAdmin && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Release
          </button>
        )}
      </div>

      {releases.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[40vh] text-center">
          <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <p className="text-[14px] font-medium mb-1">No releases yet</p>
          <p className="text-[12px] text-muted-foreground">
            {isAdmin ? "Create your first release to start tracking shipped features." : "No releases have been created yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {releases.map(r => (
            <ReleaseCard
              key={r.id}
              release={r}
              allIssues={allIssues}
              isAdmin={isAdmin}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {creating && (
        <ReleaseModal
          boardId={boardId}
          onSave={handleCreate}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}
