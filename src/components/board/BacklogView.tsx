"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { cn, getInitials } from "@/lib/utils"
import { toast } from "sonner"
import { IssueTypeIcon, PriorityIcon } from "./IssueTypeBadge"
import { IssueDetailPanel } from "./IssueDetailPanel"
import { CompleteSprintModal } from "./CompleteSprintModal"
import { StartSprintModal } from "./StartSprintModal"
import { Dropdown } from "@/components/ui/Dropdown"
import { AssigneeFilter, UNASSIGNED } from "./AssigneeFilter"
import type { Issue, Sprint, WorkflowStatus, IssueType, IssuePriority } from "@/types/database"

type Member = { id: string; name: string; avatar_color: string }

const ISSUE_TYPES: IssueType[] = ["epic", "story", "bug", "task", "subtask"]
const PRIORITIES: IssuePriority[] = ["urgent", "high", "medium", "low", "no_priority"]

/* ── helpers ─────────────────────────────────────────────── */

function sprintPoints(issues: Issue[]) {
  return issues.reduce((s, i) => s + (i.story_points ?? 0), 0)
}

/* ── main component ──────────────────────────────────────── */

export function BacklogView({
  boardId, sprints: initialSprints, allIssues: initialIssues,
  statuses, members, isAdmin, currentUserId, initialIssueId,
}: {
  boardId: string
  sprints: Sprint[]
  allIssues: Issue[]
  statuses: WorkflowStatus[]
  members: Member[]
  isAdmin: boolean
  currentUserId?: string
  initialIssueId?: string
}) {
  const [sprints, setSprints] = useState(initialSprints)
  const [issues, setIssues] = useState(initialIssues)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(
    () => initialIssueId ? (initialIssues.find(i => i.id === initialIssueId) ?? null) : null
  )
  const [selectedIssueParent, setSelectedIssueParent] = useState<Issue | null>(null)

  function openIssue(issue: Issue) {
    setSelectedIssue(issue)
    if (issue.type === "subtask" && issue.parent_id) {
      setSelectedIssueParent(issues.find(i => i.id === issue.parent_id) ?? null)
    } else {
      setSelectedIssueParent(null)
    }
  }
  useEffect(() => {
    if (!initialIssueId) return
    const issue = issues.find(i => i.id === initialIssueId)
    if (issue) openIssue(issue)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIssueId])

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [collapsedSubtasks, setCollapsedSubtasks] = useState<Record<string, boolean>>({})

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [openKebabId, setOpenKebabId] = useState<string | null>(null)
  const [showBarSprintMenu, setShowBarSprintMenu] = useState(false)
  const [showBarAssigneeMenu, setShowBarAssigneeMenu] = useState(false)
  const [showBarPriorityMenu, setShowBarPriorityMenu] = useState(false)
  const [showBarTypeMenu, setShowBarTypeMenu] = useState(false)
  const [loadingSprintId, setLoadingSprintId] = useState<string | null>(null)
  const [completeModalSprintId, setCompleteModalSprintId] = useState<string | null>(null)
  // Start-conflict: a sprint the admin tried to start while another is active
  const [startConflict, setStartConflict] = useState<{ newSprintId: string; activeSprint: { id: string; name: string } } | null>(null)

  // Filters (assignee is multi-select; persisted in the URL)
  const [search, setSearch] = useState("")
  const [filterAssignee, setFilterAssignee] = useState<string[]>([])
  const [filterType, setFilterType] = useState<IssueType | "">("")
  const [filtersHydrated, setFiltersHydrated] = useState(false)

  // Hydrate filters from the URL once on mount
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const a = sp.get("assignee")
    setFilterAssignee(a ? a.split(",").filter(Boolean) : [])
    const ty = sp.get("type")
    setFilterType((ty as IssueType) || "")
    setFiltersHydrated(true)
  }, [])

  // Persist filters to the URL (no navigation — survives refresh)
  useEffect(() => {
    if (!filtersHydrated) return
    const sp = new URLSearchParams(window.location.search)
    filterAssignee.length ? sp.set("assignee", filterAssignee.join(",")) : sp.delete("assignee")
    filterType ? sp.set("type", filterType) : sp.delete("type")
    const qs = sp.toString()
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }, [filterAssignee, filterType, filtersHydrated])

  // Create issue
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState("")
  const [newType, setNewType] = useState<IssueType>("task")
  const [newPriority, setNewPriority] = useState<IssuePriority>("medium")
  const [newAssignee, setNewAssignee] = useState("")

  // Create sprint
  const [showSprintCreate, setShowSprintCreate] = useState(false)
  const [sprintName, setSprintName] = useState("")
  const [sprintStart, setSprintStart] = useState("")
  const [sprintEnd, setSprintEnd] = useState("")
  const [savingSprint, setSavingSprint] = useState(false)

  // Edit sprint
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null)
  const [editSprintName, setEditSprintName] = useState("")
  const [editSprintStart, setEditSprintStart] = useState("")
  const [editSprintEnd, setEditSprintEnd] = useState("")
  const [savingSprintEdit, setSavingSprintEdit] = useState(false)

  const statusMap = useMemo(
    () => Object.fromEntries(statuses.map(s => [s.id, s])),
    [statuses]
  )

  // Apply filters
  const filteredIssues = useMemo(() => {
    const q = search.toLowerCase().trim()
    return issues.filter(i => {
      if (filterAssignee.length) {
        const ok = filterAssignee.includes(i.assignee_id ?? "")
          || (filterAssignee.includes(UNASSIGNED) && !i.assignee_id)
        if (!ok) return false
      }
      if (filterType && i.type !== filterType) return false
      if (q && !i.title.toLowerCase().includes(q) && !String(i.issue_number).includes(q)) return false
      return true
    })
  }, [issues, search, filterAssignee, filterType])

  const backlogIssues = filteredIssues.filter(i => !i.sprint_id && i.type !== "subtask")
  const sprintIssues = (sprintId: string) => filteredIssues.filter(i => i.sprint_id === sprintId && i.type !== "subtask")
  const hasFilters = !!search || filterAssignee.length > 0 || !!filterType

  const subtasksByParent = useMemo(() => {
    const m: Record<string, Issue[]> = {}
    issues.filter(i => i.type === "subtask" && i.parent_id).forEach(i => {
      if (!m[i.parent_id!]) m[i.parent_id!] = []
      m[i.parent_id!].push(i)
    })
    return m
  }, [issues])

  const availableSprints = sprints.filter(s => s.status !== "completed")

  /* ── selection helpers ── */

  function toggleIssue(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function setGroupSelection(ids: string[], select: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => (select ? next.add(id) : next.delete(id)))
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setShowBarSprintMenu(false)
    setShowBarAssigneeMenu(false)
    setShowBarPriorityMenu(false)
    setShowBarTypeMenu(false)
  }

  /* ── bulk actions ── */

  async function bulkDelete() {
    const ids = [...selectedIds]
    clearSelection()
    setIssues(prev => prev.filter(i => !ids.includes(i.id)))
    const results = await Promise.all(
      ids.map(id => fetch(`/api/issues?id=${id}`, { method: "DELETE" }))
    )
    const failed = results.filter(r => !r.ok)
    if (failed.length > 0) {
      toast.error(`Failed to delete ${failed.length} issue(s)`)
      setIssues(initialIssues)
    } else {
      toast.success(`Deleted ${ids.length} issue${ids.length !== 1 ? "s" : ""}`)
    }
  }

  async function bulkMoveToSprint(sprintId: string | null) {
    const ids = [...selectedIds]
    clearSelection()
    setIssues(prev => prev.map(i => ids.includes(i.id) ? { ...i, sprint_id: sprintId } : i))
    const results = await Promise.all(
      ids.map(id =>
        fetch("/api/issues", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, sprint_id: sprintId }),
        })
      )
    )
    const failed = results.filter(r => !r.ok)
    if (failed.length > 0) {
      toast.error(`Failed to move ${failed.length} issue(s)`)
      setIssues(initialIssues)
    }
  }

  async function bulkPatch(updates: Partial<Issue>) {
    const ids = [...selectedIds]
    clearSelection()
    setIssues(prev => prev.map(i => ids.includes(i.id) ? { ...i, ...updates } : i))
    const results = await Promise.all(
      ids.map(id =>
        fetch("/api/issues", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...updates }),
        })
      )
    )
    const failed = results.filter(r => !r.ok)
    if (failed.length > 0) {
      toast.error(`Failed to update ${failed.length} issue(s)`)
      setIssues(initialIssues)
    }
  }

  /* ── single issue ── */

  async function patchIssue(id: string, updates: Partial<Issue>) {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    const res = await fetch("/api/issues", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? "Failed to update issue")
      setIssues(initialIssues)
    } else {
      setIssues(prev => prev.map(i => i.id === data.id ? data : i))
      if (selectedIssue?.id === data.id) setSelectedIssue(data)
    }
  }

  async function deleteIssue(id: string) {
    setIssues(prev => prev.filter(i => i.id !== id))
    const res = await fetch(`/api/issues?id=${id}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? "Failed to delete issue")
      setIssues(initialIssues)
    }
  }

  async function createIssue(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    setNewTitle("")
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: boardId,
          title,
          type: newType,
          priority: newPriority,
          assignee_id: newAssignee || null,
          sprint_id: creatingFor === "backlog" ? null : creatingFor,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to create issue")
      setIssues(prev => [...prev, data])
      setCreatingFor(null)
    } catch (err) {
      setNewTitle(title) 
      toast.error(err instanceof Error ? err.message : "Failed to create issue")
    }
  }

  async function sprintAction(sprintId: string, action: "start" | "complete" | "reopen" | "unstart") {
    if (loadingSprintId) return

    if (action === "complete") {
      const sprintIssueList = issues.filter(i => i.sprint_id === sprintId)
      const incompleteCount = sprintIssueList.filter(
        i => statusMap[i.status_id ?? ""]?.category !== "done"
      ).length
      if (incompleteCount > 0) {
        setCompleteModalSprintId(sprintId)
        return
      }
    }

    await _doSprintAction(sprintId, action, null)
  }

  async function _doSprintAction(
    sprintId: string,
    action: "start" | "complete" | "reopen" | "unstart",
    incompleteToSprintId: string | null,
    resolve?: { activeSprintId: string; activeIncompleteTo: string | null },
  ) {
    setLoadingSprintId(sprintId)
    try {
      const res = await fetch("/api/sprints", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sprintId,
          action,
          incomplete_to_sprint_id: incompleteToSprintId,
          ...(resolve ? { resolve_active: true, active_incomplete_to: resolve.activeIncompleteTo } : {}),
        }),
      })
      const data = await res.json()

      // Server says another sprint is already active — surface the choice modal
      if (res.status === 409 && data.error === "active_sprint_exists") {
        setStartConflict({ newSprintId: sprintId, activeSprint: data.activeSprint })
        return
      }
      if (!res.ok) { toast.error(data.error ?? "Failed to update sprint"); return }

      setSprints(prev => prev.map(s => s.id === sprintId ? data : s))

      // If starting resolved an active sprint, reflect its completion locally
      if (action === "start" && resolve) {
        const activeId = resolve.activeSprintId
        setSprints(prev => prev.map(s => s.id === activeId ? { ...s, status: "completed" } : s))
        setIssues(prev => prev.map(i => {
          if (i.sprint_id !== activeId) return i
          const isDone = statusMap[i.status_id ?? ""]?.category === "done"
          return isDone ? i : { ...i, sprint_id: resolve.activeIncompleteTo }
        }))
      }

      if (action === "complete") {
        setIssues(prev => prev.map(i => {
          if (i.sprint_id !== sprintId) return i
          const isDone = statusMap[i.status_id ?? ""]?.category === "done"
          return isDone ? i : { ...i, sprint_id: incompleteToSprintId }
        }))
        toast.success("Sprint completed")
      } else if (action === "start") {
        toast.success("Sprint started")
      } else if (action === "reopen") {
        toast.success("Sprint reopened")
      } else if (action === "unstart") {
        toast.success("Sprint moved back to planning")
      }
    } finally {
      setLoadingSprintId(null)
    }
  }

  async function deleteSprint(sprintId: string) {
    const res = await fetch(`/api/sprints?id=${sprintId}`, { method: "DELETE" })
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to delete sprint"); return }
    setIssues(prev => prev.map(i => i.sprint_id === sprintId ? { ...i, sprint_id: null } : i))
    setSprints(prev => prev.filter(s => s.id !== sprintId))
    toast.success("Sprint deleted")
  }

  function openEditSprint(sprint: Sprint) {
    setEditingSprintId(sprint.id)
    setEditSprintName(sprint.name)
    setEditSprintStart(sprint.start_date ?? "")
    setEditSprintEnd(sprint.end_date ?? "")
  }

  async function saveEditSprint(e: React.FormEvent) {
    e.preventDefault()
    if (!editSprintName.trim() || !editingSprintId) return
    setSavingSprintEdit(true)
    try {
      const res = await fetch("/api/sprints", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSprintId,
          name: editSprintName.trim(),
          start_date: editSprintStart || null,
          end_date: editSprintEnd || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to update sprint")
      setSprints(prev => prev.map(s => s.id === editingSprintId ? data : s))
      setEditingSprintId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update sprint")
    } finally {
      setSavingSprintEdit(false)
    }
  }

  async function createSprint(e: React.FormEvent) {
    e.preventDefault()
    if (!sprintName.trim()) return
    setSavingSprint(true)
    try {
      const res = await fetch("/api/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: boardId,
          name: sprintName.trim(),
          start_date: sprintStart || null,
          end_date: sprintEnd || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to create sprint")
      setSprints(prev => [...prev, data])
      setShowSprintCreate(false)
      setSprintName(""); setSprintStart(""); setSprintEnd("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create sprint")
    } finally {
      setSavingSprint(false)
    }
  }

  return (
    <div className={cn("space-y-3 transition-all duration-200", selectedIssue ? "max-w-none pr-[36rem]" : "max-w-5xl")}>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search backlog…"
            className="h-8 pl-8 pr-3 text-[12px] bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-primary w-[200px] placeholder:text-muted-foreground/50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <AssigneeFilter members={members} value={filterAssignee} onChange={setFilterAssignee} />

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as IssueType | "")}
          className="h-8 px-2 text-[12px] bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-primary text-muted-foreground"
        >
          <option value="">All types</option>
          {ISSUE_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setFilterAssignee([]); setFilterType("") }}
            className="h-8 px-2.5 text-[12px] text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-secondary transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Sprints ── */}
      {sprints.map(sprint => {
        const sIssues = sprintIssues(sprint.id)
        const allSprintIssues = issues.filter(i => i.sprint_id === sprint.id)
        const isCollapsed = collapsed[sprint.id]
        const doneCount = allSprintIssues.filter(i => statusMap[i.status_id ?? ""]?.category === "done").length
        const totalPts = sprintPoints(allSprintIssues)
        const isEditingThis = editingSprintId === sprint.id
        const isKebabOpen = openKebabId === sprint.id

        return (
          <div key={sprint.id} className="border border-border rounded-lg overflow-hidden">
            {/* Sprint header */}
            {isEditingThis ? (
              <form onSubmit={saveEditSprint} className="flex items-center gap-2 px-4 py-2.5 bg-card">
                <input
                  className="flex-1 h-7 px-2 text-[13px] font-semibold bg-background border border-border rounded outline-none focus:ring-1 focus:ring-primary min-w-0"
                  value={editSprintName}
                  onChange={e => setEditSprintName(e.target.value)}
                  autoFocus
                />
                <input type="date" value={editSprintStart} onChange={e => setEditSprintStart(e.target.value)}
                  className="h-7 px-2 text-[12px] bg-background border border-border rounded outline-none dark:[color-scheme:dark]" />
                <input type="date" value={editSprintEnd} onChange={e => setEditSprintEnd(e.target.value)}
                  className="h-7 px-2 text-[12px] bg-background border border-border rounded outline-none dark:[color-scheme:dark]" />
                <button type="submit" disabled={savingSprintEdit || !editSprintName.trim()}
                  className="h-7 px-2.5 text-[11px] bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 shrink-0">
                  {savingSprintEdit ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setEditingSprintId(null)}
                  className="h-7 px-2 text-[11px] border border-border rounded hover:bg-secondary transition-colors shrink-0">
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-secondary/30 transition-colors">
                <button
                  onClick={() => setCollapsed(c => ({ ...c, [sprint.id]: !c[sprint.id] }))}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                    className={cn("transition-transform", isCollapsed && "-rotate-90")}>
                    <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {sIssues.length > 0 && (
                  <SelectAllCheckbox
                    ids={sIssues.map(i => i.id)}
                    selectedIds={selectedIds}
                    onChange={setGroupSelection}
                    title={`Select all in ${sprint.name}`}
                  />
                )}

                <span className="text-[13px] font-semibold">{sprint.name}</span>

                {sprint.start_date && sprint.end_date && (
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(sprint.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" })}
                    {" – "}
                    {new Date(sprint.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" })}
                  </span>
                )}

                <span className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                  sprint.status === "active" ? "bg-[#26d97f]/15 text-[#26d97f]" :
                    sprint.status === "completed" ? "bg-muted text-muted-foreground" :
                      "bg-secondary text-muted-foreground"
                )}>
                  {sprint.status}
                </span>

                <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                  {allSprintIssues.length} issues · {doneCount} done
                  {totalPts > 0 && ` · ${totalPts}pts`}
                </span>

                {isAdmin && (
                  <>
                    {sprint.status === "planning" && (
                      <button
                        onClick={() => sprintAction(sprint.id, "start")}
                        disabled={loadingSprintId === sprint.id}
                        className="text-[11px] px-2.5 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {loadingSprintId === sprint.id ? (
                          <>
                            <span className="w-3 h-3 border border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                            Starting…
                          </>
                        ) : "Start sprint"}
                      </button>
                    )}

                    <div className="relative shrink-0">
                      <button
                        onClick={() => setOpenKebabId(id => id === sprint.id ? null : sprint.id)}
                        className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Sprint options"
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                          <circle cx="8" cy="3.5" r="1.2" />
                          <circle cx="8" cy="8" r="1.2" />
                          <circle cx="8" cy="12.5" r="1.2" />
                        </svg>
                      </button>

                      {isKebabOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenKebabId(null)} />
                          <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl py-1 z-20 min-w-[170px]">

                            {/* Complete — active only */}
                            {sprint.status === "active" && (
                              <button
                                onClick={() => { setOpenKebabId(null); sprintAction(sprint.id, "complete") }}
                                disabled={loadingSprintId === sprint.id}
                                className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                  <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Complete sprint
                              </button>
                            )}

                            {/* Move back to planning (revert a mistaken start) — active only */}
                            {sprint.status === "active" && (
                              <button
                                onClick={() => { setOpenKebabId(null); sprintAction(sprint.id, "unstart") }}
                                disabled={loadingSprintId === sprint.id}
                                className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                  <path d="M2 8a6 6 0 1 1 1.5 4M2 12V8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Move to planning
                              </button>
                            )}

                            {/* Reopen — completed only */}
                            {sprint.status === "completed" && (
                              <button
                                onClick={() => { setOpenKebabId(null); sprintAction(sprint.id, "reopen") }}
                                disabled={loadingSprintId === sprint.id}
                                className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                  <path d="M2 8a6 6 0 1 1 1.5 4M2 12V8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Reopen sprint
                              </button>
                            )}

                            {/* Edit — planning + active only */}
                            {sprint.status !== "completed" && (
                              <button
                                onClick={() => { openEditSprint(sprint); setOpenKebabId(null) }}
                                className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors flex items-center gap-2"
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                  <path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Edit sprint
                              </button>
                            )}

                            {/* Delete — planning only */}
                            {sprint.status === "planning" && (
                              <button
                                onClick={() => {
                                  setOpenKebabId(null)
                                  toast.warning(`Delete "${sprint.name}"?`, {
                                    description: "All issues will be moved to backlog.",
                                    action: { label: "Delete", onClick: () => deleteSprint(sprint.id) },
                                    duration: 8000,
                                  })
                                }}
                                className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors flex items-center gap-2 text-destructive"
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Delete sprint
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {!isCollapsed && !isEditingThis && (
              <div>
                {sIssues.length === 0 && hasFilters ? (
                  <p className="px-4 py-3 text-[12px] text-muted-foreground/50 italic">No issues match filters</p>
                ) : (
                  sIssues.map(issue => {
                    const subs = subtasksByParent[issue.id] ?? []
                    const subsCollapsed = !!collapsedSubtasks[issue.id]
                    return (
                      <div key={issue.id}>
                        <IssueRow
                          issue={issue}
                          statuses={statuses}
                          members={members}
                          selected={selectedIds.has(issue.id)}
                          onToggle={() => toggleIssue(issue.id)}
                          onOpen={() => openIssue(issue)}
                          onStatusChange={sid => patchIssue(issue.id, { status_id: sid })}
                          onMoveToBacklog={() => patchIssue(issue.id, { sprint_id: null })}
                          isInSprint
                          subtaskCount={subs.length}
                          subtasksCollapsed={subsCollapsed}
                          onToggleSubtasks={() => setCollapsedSubtasks(p => ({ ...p, [issue.id]: !p[issue.id] }))}
                        />
                        {!subsCollapsed && subs.map(sub => (
                          <SubtaskRow
                            key={sub.id}
                            subtask={sub}
                            statuses={statuses}
                            members={members}
                            onOpen={() => openIssue(sub)}
                            onStatusChange={sid => patchIssue(sub.id, { status_id: sid })}
                          />
                        ))}
                      </div>
                    )
                  })
                )}

                {creatingFor === sprint.id ? (
                  <QuickCreate
                    members={members}
                    title={newTitle} type={newType} priority={newPriority} assignee={newAssignee}
                    onTitle={setNewTitle} onType={setNewType} onPriority={setNewPriority} onAssignee={setNewAssignee}
                    onSubmit={createIssue} onCancel={() => { setCreatingFor(null); setNewTitle("") }}
                  />
                ) : (
                  <button
                    onClick={() => setCreatingFor(sprint.id)}
                    className="flex items-center gap-1.5 w-full px-4 py-2 text-[12px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary/40 transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    Create issue
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Create sprint ── */}
      {isAdmin && (
        showSprintCreate ? (
          <div className="border border-border rounded-lg p-4">
            <form onSubmit={createSprint} className="space-y-3">
              <input
                className="w-full h-8 px-3 text-[13px] bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-primary"
                placeholder="Sprint name (e.g. Sprint 13)"
                value={sprintName} onChange={e => setSprintName(e.target.value)} autoFocus
              />
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Start date</label>
                  <input type="date" value={sprintStart} onChange={e => setSprintStart(e.target.value)}
                    className="w-full h-8 px-3 text-[12px] bg-secondary border border-border rounded-md outline-none dark:[color-scheme:dark]" />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">End date</label>
                  <input type="date" value={sprintEnd} onChange={e => setSprintEnd(e.target.value)}
                    className="w-full h-8 px-3 text-[12px] bg-secondary border border-border rounded-md outline-none dark:[color-scheme:dark]" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowSprintCreate(false)}
                  className="flex-1 h-8 text-[12px] border border-border rounded-md hover:bg-secondary transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={savingSprint || !sprintName.trim()}
                  className="flex-1 h-8 text-[12px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {savingSprint ? "Creating…" : "Create sprint"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowSprintCreate(true)}
            className="flex items-center gap-1.5 w-full px-4 py-2.5 text-[12px] text-muted-foreground/50 hover:text-muted-foreground border border-dashed border-border rounded-lg hover:bg-secondary/20 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Create sprint
          </button>
        )
      )}

      {/* ── Backlog ── */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-card">
          {backlogIssues.length > 0 && (
            <SelectAllCheckbox
              ids={backlogIssues.map(i => i.id)}
              selectedIds={selectedIds}
              onChange={setGroupSelection}
              title="Select all in backlog"
            />
          )}
          <span className="text-[13px] font-semibold flex-1">Backlog</span>
          <span className="text-[11px] text-muted-foreground">{issues.filter(i => !i.sprint_id).length} issues</span>
        </div>

        {backlogIssues.length === 0 && hasFilters ? (
          <p className="px-4 py-3 text-[12px] text-muted-foreground/50 italic">No issues match filters</p>
        ) : (
          backlogIssues.map(issue => {
            const subs = subtasksByParent[issue.id] ?? []
            const subsCollapsed = !!collapsedSubtasks[issue.id]
            return (
              <div key={issue.id}>
                <IssueRow
                  issue={issue}
                  statuses={statuses}
                  members={members}
                  selected={selectedIds.has(issue.id)}
                  onToggle={() => toggleIssue(issue.id)}
                  onOpen={() => openIssue(issue)}
                  onStatusChange={sid => patchIssue(issue.id, { status_id: sid })}
                  sprintOptions={availableSprints}
                  onMoveToSprint={sid => patchIssue(issue.id, { sprint_id: sid })}
                  subtaskCount={subs.length}
                  subtasksCollapsed={subsCollapsed}
                  onToggleSubtasks={() => setCollapsedSubtasks(p => ({ ...p, [issue.id]: !p[issue.id] }))}
                />
                {!subsCollapsed && subs.map(sub => (
                  <SubtaskRow
                    key={sub.id}
                    subtask={sub}
                    statuses={statuses}
                    members={members}
                    onOpen={() => openIssue(sub)}
                    onStatusChange={sid => patchIssue(sub.id, { status_id: sid })}
                  />
                ))}
              </div>
            )
          })
        )}

        {creatingFor === "backlog" ? (
          <QuickCreate
            members={members}
            title={newTitle} type={newType} priority={newPriority} assignee={newAssignee}
            onTitle={setNewTitle} onType={setNewType} onPriority={setNewPriority} onAssignee={setNewAssignee}
            onSubmit={createIssue} onCancel={() => { setCreatingFor(null); setNewTitle("") }}
          />
        ) : (
          <button
            onClick={() => setCreatingFor("backlog")}
            className="flex items-center gap-1.5 w-full px-4 py-2 text-[12px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary/40 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Create issue
          </button>
        )}
      </div>

      {/* ── Issue detail panel ── */}
      {selectedIssue && (
        <IssueDetailPanel
          key={selectedIssue.id}
          issue={selectedIssue}
          parentIssue={selectedIssueParent ?? undefined}
          statuses={statuses}
          members={members}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onClose={() => { setSelectedIssue(null); setSelectedIssueParent(null) }}
          onUpdate={updated => {
            setIssues(prev => prev.map(i => i.id === updated.id ? updated : i))
            setSelectedIssue(updated)
          }}
          onDelete={id => {
            setIssues(prev => prev.filter(i => i.id !== id))
            setSelectedIssue(null)
            setSelectedIssueParent(null)
          }}
        />
      )}

      {/* ── Floating selection action bar ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-popover border border-border rounded-xl shadow-2xl px-3 py-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="text-[12px] font-medium text-foreground px-1 mr-1 tabular-nums">
            {selectedIds.size} selected
          </span>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Move to sprint */}
          {availableSprints.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowBarSprintMenu(v => !v)}
                className="flex items-center gap-1.5 h-7 px-2.5 text-[12px] rounded-lg hover:bg-secondary transition-colors text-foreground"
              >
                Move to sprint
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {showBarSprintMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowBarSprintMenu(false)} />
                  <div className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-lg shadow-xl py-1 z-20 min-w-[160px]">
                    {availableSprints.map(s => (
                      <button
                        key={s.id}
                        onClick={() => bulkMoveToSprint(s.id)}
                        className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors truncate flex items-center gap-2"
                      >
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          s.status === "active" ? "bg-[#26d97f]" : "bg-muted-foreground"
                        )} />
                        {s.name}
                      </button>
                    ))}
                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        onClick={() => bulkMoveToSprint(null)}
                        className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors text-muted-foreground"
                      >
                        Move to backlog
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Assignee */}
          <div className="relative">
            <button
              onClick={() => { setShowBarAssigneeMenu(v => !v); setShowBarSprintMenu(false); setShowBarPriorityMenu(false); setShowBarTypeMenu(false) }}
              className="flex items-center gap-1.5 h-7 px-2.5 text-[12px] rounded-lg hover:bg-secondary transition-colors text-foreground"
            >
              Assignee
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showBarAssigneeMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowBarAssigneeMenu(false)} />
                <div className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-lg shadow-xl py-1 z-20 min-w-[160px]">
                  <button onClick={() => bulkPatch({ assignee_id: null })}
                    className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors text-muted-foreground flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-dashed border-muted-foreground/40 shrink-0" />
                    Unassigned
                  </button>
                  {members.map(m => (
                    <button key={m.id} onClick={() => bulkPatch({ assignee_id: m.id })}
                      className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                        style={{ backgroundColor: m.avatar_color }}>{getInitials(m.name)}</span>
                      {m.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Priority */}
          <div className="relative">
            <button
              onClick={() => { setShowBarPriorityMenu(v => !v); setShowBarSprintMenu(false); setShowBarAssigneeMenu(false); setShowBarTypeMenu(false) }}
              className="flex items-center gap-1.5 h-7 px-2.5 text-[12px] rounded-lg hover:bg-secondary transition-colors text-foreground"
            >
              Priority
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showBarPriorityMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowBarPriorityMenu(false)} />
                <div className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-lg shadow-xl py-1 z-20 min-w-[140px]">
                  {(["urgent","high","medium","low","no_priority"] as IssuePriority[]).map(p => {
                    const COLORS: Record<string, string> = { urgent:"#f54260", high:"#f5a524", medium:"#5e6ad2", low:"#26d97f", no_priority:"#6b7280" }
                    const LABELS: Record<string, string> = { urgent:"Urgent", high:"High", medium:"Medium", low:"Low", no_priority:"No priority" }
                    return (
                      <button key={p} onClick={() => bulkPatch({ priority: p })}
                        className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[p] }} />
                        {LABELS[p]}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Type */}
          <div className="relative">
            <button
              onClick={() => { setShowBarTypeMenu(v => !v); setShowBarSprintMenu(false); setShowBarAssigneeMenu(false); setShowBarPriorityMenu(false) }}
              className="flex items-center gap-1.5 h-7 px-2.5 text-[12px] rounded-lg hover:bg-secondary transition-colors text-foreground"
            >
              Type
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showBarTypeMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowBarTypeMenu(false)} />
                <div className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-lg shadow-xl py-1 z-20 min-w-[130px]">
                  {(["epic","story","bug","task"] as IssueType[]).map(t => {
                    const LABELS: Record<string, string> = { epic:"Epic", story:"Story", bug:"Bug", task:"Task" }
                    return (
                      <button key={t} onClick={() => bulkPatch({ type: t })}
                        className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors capitalize">
                        {LABELS[t]}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => {
              toast.warning(`Delete ${selectedIds.size} issue${selectedIds.size !== 1 ? "s" : ""}?`, {
                description: "This action cannot be undone.",
                action: { label: "Delete", onClick: bulkDelete },
                duration: 8000,
              })
            }}
            className="flex items-center gap-1.5 h-7 px-2.5 text-[12px] rounded-lg hover:bg-destructive/10 transition-colors text-destructive"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Delete
          </button>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Clear */}
          <button
            onClick={clearSelection}
            className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Clear selection"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Complete Sprint Modal ── */}
      {completeModalSprintId && (() => {
        const modalSprint = sprints.find(s => s.id === completeModalSprintId)!
        const sprintIssueList = issues.filter(i => i.sprint_id === completeModalSprintId)
        const incompleteCount = sprintIssueList.filter(
          i => statusMap[i.status_id ?? ""]?.category !== "done"
        ).length
        const otherSprints = sprints.filter(s => s.id !== completeModalSprintId && s.status !== "completed")
        return (
          <CompleteSprintModal
            sprint={modalSprint}
            incompleteCount={incompleteCount}
            otherSprints={otherSprints}
            loading={loadingSprintId === completeModalSprintId}
            onConfirm={async (incompleteToSprintId) => {
              await _doSprintAction(completeModalSprintId, "complete", incompleteToSprintId)
              setCompleteModalSprintId(null)
            }}
            onCancel={() => setCompleteModalSprintId(null)}
          />
        )
      })()}

      {/* ── Start Sprint conflict modal ── */}
      {startConflict && (() => {
        const newSprint = sprints.find(s => s.id === startConflict.newSprintId)
        if (!newSprint) return null
        return (
          <StartSprintModal
            newSprint={newSprint}
            activeSprint={startConflict.activeSprint}
            loading={loadingSprintId === startConflict.newSprintId}
            onConfirm={async (activeIncompleteTo) => {
              await _doSprintAction(startConflict.newSprintId, "start", null, {
                activeSprintId: startConflict.activeSprint.id,
                activeIncompleteTo,
              })
              setStartConflict(null)
            }}
            onCancel={() => setStartConflict(null)}
          />
        )
      })()}

    </div>
  )
}

/* ── SelectAllCheckbox ────────────────────────────────────── */

function SelectAllCheckbox({
  ids, selectedIds, onChange, title,
}: {
  ids: string[]
  selectedIds: Set<string>
  onChange: (ids: string[], select: boolean) => void
  title: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const selectedCount = ids.filter(id => selectedIds.has(id)).length
  const allSelected = ids.length > 0 && selectedCount === ids.length
  const someSelected = selectedCount > 0 && !allSelected

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected
  }, [someSelected])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allSelected}
      title={title}
      onClick={e => e.stopPropagation()}
      onChange={() => onChange(ids, !allSelected)}
      className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer shrink-0"
    />
  )
}

/* ── IssueRow ─────────────────────────────────────────────── */

function IssueRow({
  issue, statuses, members, selected, onToggle, onOpen, onStatusChange,
  onMoveToBacklog, sprintOptions, onMoveToSprint, isInSprint,
  subtaskCount, subtasksCollapsed, onToggleSubtasks,
}: {
  issue: Issue
  statuses: WorkflowStatus[]
  members: Member[]
  selected: boolean
  onToggle: () => void
  onOpen: () => void
  onStatusChange: (statusId: string) => void
  onMoveToBacklog?: () => void
  sprintOptions?: Sprint[]
  onMoveToSprint?: (sprintId: string) => void
  isInSprint?: boolean
  subtaskCount?: number
  subtasksCollapsed?: boolean
  onToggleSubtasks?: () => void
}) {
  const status = statuses.find(s => s.id === issue.status_id)
  const assignee = members.find(m => m.id === issue.assignee_id)
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-2 hover:bg-secondary/30 transition-colors border-t border-border/40 group min-w-0",
      selected && "bg-primary/5 hover:bg-primary/8"
    )}>
      {/* Checkbox / type icon toggle */}
      <div className="relative w-[14px] h-[14px] shrink-0 flex items-center justify-center">
        <span className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity pointer-events-none",
          selected ? "opacity-0" : "opacity-100 group-hover:opacity-0"
        )}>
          <IssueTypeIcon type={issue.type} size={13} />
        </span>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={e => e.stopPropagation()}
          className={cn(
            "absolute inset-0 w-[14px] h-[14px] cursor-pointer accent-primary rounded transition-opacity",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        />
      </div>

      <PriorityIcon priority={issue.priority} />

      <span className="text-[11px] font-mono text-muted-foreground/40 shrink-0 w-16 truncate">
        {(issue as any).board?.key ?? ""}-{issue.issue_number}
      </span>

      <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={onOpen}>
        <span className="text-[13px] truncate cursor-pointer hover:text-primary transition-colors min-w-0">
          {issue.title}
        </span>
        {subtaskCount != null && subtaskCount > 0 && (
          <button
            onClick={e => { e.stopPropagation(); onToggleSubtasks?.() }}
            className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground px-1 py-0.5 rounded hover:bg-secondary transition-colors shrink-0"
            title={subtasksCollapsed ? "Show subtasks" : "Hide subtasks"}
          >
            <svg width="8" height="8" viewBox="0 0 9 9" fill="none"
              className={cn("transition-transform duration-150", !subtasksCollapsed && "rotate-90")}>
              <path d="M2 1.5l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {subtaskCount}
          </button>
        )}
      </div>

      {issue.story_points != null && (
        <span className="text-[11px] text-muted-foreground/50 shrink-0 w-8 text-right">
          {issue.story_points}sp
        </span>
      )}

      {/* Inline status dropdown */}
      <div className="shrink-0">
        <Dropdown
          align="right"
          width={170}
          buttonClassName={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-sm transition-colors hover:opacity-80",
            !status && "border border-dashed border-border text-muted-foreground"
          )}
          buttonStyle={status ? { color: status.color, backgroundColor: status.color + "18" } : undefined}
          button={status?.name ?? "No status"}
        >
          {close => statuses.map(s => (
            <button
              key={s.id}
              onClick={() => { onStatusChange(s.id); close() }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors flex items-center gap-2",
                issue.status_id === s.id && "bg-secondary/50"
              )}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              {s.name}
            </button>
          ))}
        </Dropdown>
      </div>

      {/* Assignee */}
      {assignee ? (
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
          style={{ backgroundColor: assignee.avatar_color }}
          title={assignee.name}
        >
          {getInitials(assignee.name)}
        </div>
      ) : (
        <div className="w-5 h-5 rounded-full border border-dashed border-border shrink-0" />
      )}

      {/* Move actions (hover) */}
      <div className="relative opacity-0 group-hover:opacity-100 transition-opacity shrink-0 min-w-[68px] flex justify-end">
        {isInSprint && onMoveToBacklog && (
          <button
            onClick={onMoveToBacklog}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary transition-colors whitespace-nowrap"
          >
            To backlog
          </button>
        )}

        {sprintOptions && sprintOptions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowMoveMenu(v => !v)}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary transition-colors whitespace-nowrap"
            >
              To sprint
            </button>
            {showMoveMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMoveMenu(false)} />
                <div className="absolute right-0 bottom-full mb-1 bg-popover border border-border rounded-lg shadow-xl py-1 z-20 min-w-[150px]">
                  {sprintOptions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { onMoveToSprint?.(s.id); setShowMoveMenu(false) }}
                      className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors truncate"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── QuickCreate ──────────────────────────────────────────── */

function QuickCreate({ members, title, type, priority, assignee,
  onTitle, onType, onPriority, onAssignee, onSubmit, onCancel }: {
    members: Member[]
    title: string; type: IssueType; priority: IssuePriority; assignee: string
    onTitle: (v: string) => void; onType: (v: IssueType) => void
    onPriority: (v: IssuePriority) => void; onAssignee: (v: string) => void
    onSubmit: (e: React.FormEvent) => void; onCancel: () => void
  }) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 px-4 py-2 border-t border-border/40 bg-secondary/20"
    >
      <input
        className="flex-1 h-7 px-2 text-[13px] bg-background border border-border rounded outline-none focus:ring-1 focus:ring-primary min-w-0"
        placeholder="Issue title…"
        value={title}
        onChange={e => onTitle(e.target.value)}
        autoFocus
        onKeyDown={e => e.key === "Escape" && onCancel()}
      />
      <select value={type} onChange={e => onType(e.target.value as IssueType)}
        className="h-7 px-1.5 text-[11px] bg-background border border-border rounded outline-none shrink-0">
        {ISSUE_TYPES.filter(t => t !== "subtask").map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={priority} onChange={e => onPriority(e.target.value as IssuePriority)}
        className="h-7 px-1.5 text-[11px] bg-background border border-border rounded outline-none shrink-0">
        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={assignee} onChange={e => onAssignee(e.target.value)}
        className="h-7 px-1.5 text-[11px] bg-background border border-border rounded outline-none shrink-0">
        <option value="">Unassigned</option>
        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <button type="submit" disabled={!title.trim()}
        className="h-7 px-2.5 text-[11px] bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-40 shrink-0">
        Create
      </button>
      <button type="button" onClick={onCancel}
        className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-secondary transition-colors shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </form>
  )
}

/* ── SubtaskRow ──────────────────────────────────────── */

function SubtaskRow({ subtask, statuses, members, onOpen, onStatusChange }: {
  subtask: Issue
  statuses: WorkflowStatus[]
  members: Member[]
  onOpen: () => void
  onStatusChange: (statusId: string) => void
}) {
  const status = statuses.find(s => s.id === subtask.status_id)
  const assignee = members.find(m => m.id === subtask.assignee_id)

  return (
    <div className="flex items-center gap-2 pr-4 border-t border-border/40 group min-w-0 hover:bg-secondary/30 transition-colors bg-secondary/10">
      {/* indent connector */}
      <div className="pl-5 shrink-0 flex items-center gap-1 self-stretch py-2">
        <div className="w-px self-stretch bg-border/50" />
        <svg width="7" height="7" viewBox="0 0 7 7" fill="none" className="text-muted-foreground/30 shrink-0 -ml-px">
          <path d="M1 0v4a1 1 0 001 1h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="w-[14px] h-[14px] shrink-0 flex items-center justify-center">
        <IssueTypeIcon type={subtask.type} size={13} />
      </div>

      <PriorityIcon priority={subtask.priority} />

      <span className="text-[11px] font-mono text-muted-foreground/40 shrink-0 w-16 truncate">
        {(subtask as any).board?.key ?? ""}-{subtask.issue_number}
      </span>

      <span
        className="flex-1 text-[13px] truncate cursor-pointer hover:text-primary transition-colors min-w-0"
        onClick={onOpen}
      >
        {subtask.title}
      </span>

      {subtask.story_points != null && (
        <span className="text-[11px] text-muted-foreground/50 shrink-0 w-8 text-right">
          {subtask.story_points}sp
        </span>
      )}

      <div className="shrink-0">
        <Dropdown
          align="right"
          width={170}
          buttonClassName={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-sm transition-colors hover:opacity-80",
            !status && "border border-dashed border-border text-muted-foreground"
          )}
          buttonStyle={status ? { color: status.color, backgroundColor: status.color + "18" } : undefined}
          button={status?.name ?? "No status"}
        >
          {close => statuses.map(s => (
            <button key={s.id}
              onClick={() => { onStatusChange(s.id); close() }}
              className={cn("w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors flex items-center gap-2",
                subtask.status_id === s.id && "bg-secondary/50")}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              {s.name}
            </button>
          ))}
        </Dropdown>
      </div>

      {assignee ? (
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
          style={{ backgroundColor: assignee.avatar_color }} title={assignee.name}>
          {getInitials(assignee.name)}
        </div>
      ) : (
        <div className="w-5 h-5 rounded-full border border-dashed border-border shrink-0" />
      )}

      {/* spacer to match parent's move-actions reserved area */}
      <div className="min-w-[68px] shrink-0" />
    </div>
  )
}
