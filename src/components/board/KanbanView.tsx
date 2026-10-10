"use client"

import { useState, useMemo, useEffect } from "react"
import { cn, getInitials } from "@/lib/utils"
import { AssigneeFilter, UNASSIGNED } from "./AssigneeFilter"
import { toast } from "sonner"
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { IssueTypeIcon, PriorityIcon } from "./IssueTypeBadge"
import { IssueDetailPanel } from "./IssueDetailPanel"
import type { Issue, Sprint, WorkflowStatus, IssueType, IssuePriority } from "@/types/database"

type Member = { id: string; name: string; avatar_color: string }

export function KanbanView({
  boardId, activeSprint, statuses, allIssues, members, isAdmin, currentUserId,
}: {
  boardId: string
  activeSprint: Sprint | null
  statuses: WorkflowStatus[]
  allIssues: Issue[]
  members: Member[]
  isAdmin: boolean
  currentUserId: string
}) {
  const [issues, setIssues] = useState(allIssues)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBarStatusMenu, setShowBarStatusMenu] = useState(false)
  const [showBarAssigneeMenu, setShowBarAssigneeMenu] = useState(false)
  const [showBarPriorityMenu, setShowBarPriorityMenu] = useState(false)
  const [showBarTypeMenu, setShowBarTypeMenu] = useState(false)

  // Filters (assignee is multi-select; persisted in the URL)
  const [search, setSearch] = useState("")
  const [filterAssignee, setFilterAssignee] = useState<string[]>([])
  const [filterType, setFilterType] = useState<IssueType | "">("")
  const [filtersHydrated, setFiltersHydrated] = useState(false)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const a = sp.get("assignee")
    setFilterAssignee(a ? a.split(",").filter(Boolean) : [])
    const ty = sp.get("type")
    setFilterType((ty as IssueType) || "")
    setFiltersHydrated(true)
  }, [])

  useEffect(() => {
    if (!filtersHydrated) return
    const sp = new URLSearchParams(window.location.search)
    filterAssignee.length ? sp.set("assignee", filterAssignee.join(",")) : sp.delete("assignee")
    filterType ? sp.set("type", filterType) : sp.delete("type")
    const qs = sp.toString()
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }, [filterAssignee, filterType, filtersHydrated])

  // Quick create
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState("")
  const [newType, setNewType] = useState<IssueType>("task")
  const [newPriority, setNewPriority] = useState<IssuePriority>("medium")

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const sprintIssues = useMemo(() =>
    activeSprint ? issues.filter(i => i.sprint_id === activeSprint.id) : [],
    [issues, activeSprint]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return sprintIssues.filter(i => {
      if (filterAssignee.length) {
        const ok = filterAssignee.includes(i.assignee_id ?? "")
          || (filterAssignee.includes(UNASSIGNED) && !i.assignee_id)
        if (!ok) return false
      }
      if (filterType && i.type !== filterType) return false
      if (q && !i.title.toLowerCase().includes(q) && !String(i.issue_number).includes(q)) return false
      return true
    })
  }, [sprintIssues, search, filterAssignee, filterType])

  const issuesByStatusMap = useMemo(() => {
    const map = new Map<string, Issue[]>()
    for (const issue of filtered) {
      const sid = issue.status_id ?? ""
      if (!sid) continue
      const col = map.get(sid)
      if (col) col.push(issue)
      else map.set(sid, [issue])
    }
    return map
  }, [filtered])

  const issuesByStatus = (statusId: string) => issuesByStatusMap.get(statusId) ?? []

  const hasFilters = !!search || filterAssignee.length > 0 || !!filterType

  /* ── selection helpers ── */

  function toggleIssue(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setShowBarStatusMenu(false)
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
      setIssues(allIssues)
    } else {
      toast.success(`Deleted ${ids.length} issue${ids.length !== 1 ? "s" : ""}`)
    }
  }

  async function bulkChangeStatus(statusId: string) {
    const ids = [...selectedIds]
    clearSelection()
    setIssues(prev => prev.map(i => ids.includes(i.id) ? { ...i, status_id: statusId } : i))
    const results = await Promise.all(
      ids.map(id =>
        fetch("/api/issues", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status_id: statusId }),
        })
      )
    )
    const failed = results.filter(r => !r.ok)
    if (failed.length > 0) {
      toast.error(`Failed to update ${failed.length} issue(s)`)
      setIssues(allIssues)
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
      setIssues(allIssues)
    }
  }

  /* ── drag & drop ── */

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const issueId = active.id as string

    let newStatusId: string
    if (over.data.current?.type === "column") {
      newStatusId = over.id as string
    } else {
      const targetIssue = issues.find(i => i.id === (over.id as string))
      if (!targetIssue?.status_id) return
      newStatusId = targetIssue.status_id
    }

    const draggedIssue = issues.find(i => i.id === issueId)
    if (!draggedIssue || draggedIssue.status_id === newStatusId) return

    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status_id: newStatusId } : i))

    const res = await fetch("/api/issues", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: issueId, status_id: newStatusId }),
    })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? "Failed to update status")
      setIssues(allIssues)
    } else {
      const updated = await res.json()
      setIssues(prev => prev.map(i => i.id === updated.id ? updated : i))
    }
  }

  async function deleteIssue(id: string) {
    setIssues(prev => prev.filter(i => i.id !== id))
    const res = await fetch(`/api/issues?id=${id}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? "Failed to delete issue")
      setIssues(allIssues)
    }
  }

  async function createIssue(statusId: string) {
    const title = newTitle.trim()
    if (!title || !activeSprint) return
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
          status_id: statusId,
          sprint_id: activeSprint.id,
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

  const draggingIssue = draggingId ? issues.find(i => i.id === draggingId) : null

  if (!activeSprint) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-3">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M6 9h6M9 6v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-[14px] font-medium mb-1">No active sprint</p>
        <p className="text-[12px] text-muted-foreground">
          {isAdmin ? "Go to Backlog to create and start a sprint." : "Ask your admin to start a sprint."}
        </p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full gap-3 transition-all duration-200", selectedIssue && "pr-[42rem]")}>
      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {/* Sprint info */}
        <div className="mr-2">
          <span className="text-[13px] font-semibold">{activeSprint.name}</span>
          {activeSprint.start_date && activeSprint.end_date && (
            <span className="text-[11px] text-muted-foreground ml-2">
              {new Date(activeSprint.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" })}
              {" – "}
              {new Date(activeSprint.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" })}
              {" · "}{sprintIssues.length} issues
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-7 pl-8 pr-3 text-[12px] bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-primary w-[160px] placeholder:text-muted-foreground/50"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as IssueType | "")}
            className="h-7 px-2 text-[11px] bg-secondary border border-border rounded-md outline-none text-muted-foreground"
          >
            <option value="">All types</option>
            {(["epic","story","bug","task","subtask"] as IssueType[]).map(t => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </select>

          {/* Assignee filter (multi-select + searchable overflow) */}
          <AssigneeFilter members={members} value={filterAssignee} onChange={setFilterAssignee} />

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={() => { setSearch(""); setFilterAssignee([]); setFilterType("") }}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-secondary transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Board columns ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => setDraggingId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-3 flex-1 items-start">
          {statuses.map(status => {
            const colIssues = issuesByStatus(status.id)
            return (
              <KanbanColumn
                key={status.id}
                status={status}
                issues={colIssues}
                members={members}
                selectedIds={selectedIds}
                onToggleIssue={toggleIssue}
                onIssueClick={setSelectedIssue}
                isCreating={creatingFor === status.id}
                onCreateOpen={() => setCreatingFor(status.id)}
                onCreateClose={() => { setCreatingFor(null); setNewTitle("") }}
                newTitle={newTitle}
                onNewTitle={setNewTitle}
                newType={newType}
                onNewType={setNewType}
                newPriority={newPriority}
                onNewPriority={setNewPriority}
                onCreateSubmit={() => createIssue(status.id)}
              />
            )
          })}
        </div>

        <DragOverlay>
          {draggingIssue && (
            <IssueCard
              issue={draggingIssue}
              members={members}
              selected={false}
              onToggle={() => {}}
              onClick={() => {}}
              isDragging
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Detail panel ── */}
      {selectedIssue && (
        <IssueDetailPanel
          key={selectedIssue.id}
          issue={selectedIssue}
          statuses={statuses}
          members={members}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onClose={() => setSelectedIssue(null)}
          onUpdate={updated => {
            setIssues(prev => prev.map(i => i.id === updated.id ? updated : i))
            setSelectedIssue(updated)
          }}
          onDelete={id => {
            setIssues(prev => prev.filter(i => i.id !== id))
            setSelectedIssue(null)
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

          {/* Change status */}
          <div className="relative">
            <button
              onClick={() => setShowBarStatusMenu(v => !v)}
              className="flex items-center gap-1.5 h-7 px-2.5 text-[12px] rounded-lg hover:bg-secondary transition-colors text-foreground"
            >
              Change status
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showBarStatusMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowBarStatusMenu(false)} />
                <div className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-lg shadow-xl py-1 z-20 min-w-[160px]">
                  {statuses.map(s => (
                    <button
                      key={s.id}
                      onClick={() => bulkChangeStatus(s.id)}
                      className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Assignee */}
          <div className="relative">
            <button
              onClick={() => { setShowBarAssigneeMenu(v => !v); setShowBarStatusMenu(false); setShowBarPriorityMenu(false); setShowBarTypeMenu(false) }}
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
              onClick={() => { setShowBarPriorityMenu(v => !v); setShowBarStatusMenu(false); setShowBarAssigneeMenu(false); setShowBarTypeMenu(false) }}
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
              onClick={() => { setShowBarTypeMenu(v => !v); setShowBarStatusMenu(false); setShowBarAssigneeMenu(false); setShowBarPriorityMenu(false) }}
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
    </div>
  )
}

/* ── KanbanColumn ─────────────────────────────────────────── */

function KanbanColumn({
  status, issues, members, selectedIds, onToggleIssue, onIssueClick,
  isCreating, onCreateOpen, onCreateClose,
  newTitle, onNewTitle, newType, onNewType,
  newPriority, onNewPriority, onCreateSubmit,
}: {
  status: WorkflowStatus
  issues: Issue[]
  members: Member[]
  selectedIds: Set<string>
  onToggleIssue: (id: string) => void
  onIssueClick: (i: Issue) => void
  isCreating: boolean
  onCreateOpen: () => void
  onCreateClose: () => void
  newTitle: string
  onNewTitle: (v: string) => void
  newType: IssueType
  onNewType: (v: IssueType) => void
  newPriority: IssuePriority
  onNewPriority: (v: IssuePriority) => void
  onCreateSubmit: () => void
}) {
  const { setNodeRef, isOver } = useSortable({ id: status.id, data: { type: "column" } })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[260px] shrink-0 rounded-lg transition-colors",
        isOver && "ring-1 ring-primary/40"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-2 mb-1">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
        <span className="text-[12px] font-semibold flex-1 truncate">{status.name}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{issues.length}</span>
        <button
          onClick={onCreateOpen}
          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors ml-1"
          title="Add issue"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Cards */}
      <SortableContext items={issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5 min-h-[120px]">
          {issues.map(issue => (
            <SortableIssueCard
              key={issue.id}
              issue={issue}
              members={members}
              selected={selectedIds.has(issue.id)}
              onToggle={() => onToggleIssue(issue.id)}
              onClick={() => onIssueClick(issue)}
            />
          ))}
        </div>
      </SortableContext>

      {/* Quick create */}
      {isCreating && (
        <div className="mt-1.5 p-2 bg-card border border-border rounded-lg space-y-2">
          <input
            className="w-full h-7 px-2 text-[12px] bg-secondary border border-border rounded outline-none focus:ring-1 focus:ring-primary"
            placeholder="Issue title…"
            value={newTitle}
            onChange={e => onNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") onCreateSubmit()
              if (e.key === "Escape") onCreateClose()
            }}
            autoFocus
          />
          <div className="flex gap-1.5">
            <select
              value={newType}
              onChange={e => onNewType(e.target.value as IssueType)}
              className="flex-1 h-6 text-[10px] bg-secondary border border-border rounded outline-none px-1"
            >
              {(["task","bug","story","epic"] as IssueType[]).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={newPriority}
              onChange={e => onNewPriority(e.target.value as IssuePriority)}
              className="flex-1 h-6 text-[10px] bg-secondary border border-border rounded outline-none px-1"
            >
              {(["medium","high","low","urgent"] as IssuePriority[]).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={onCreateSubmit}
              disabled={!newTitle.trim()}
              className="flex-1 h-6 text-[11px] bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-40"
            >
              Create
            </button>
            <button
              onClick={onCreateClose}
              className="flex-1 h-6 text-[11px] border border-border rounded hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── SortableIssueCard ────────────────────────────────────── */

function SortableIssueCard({ issue, members, selected, onToggle, onClick }: {
  issue: Issue
  members: Member[]
  selected: boolean
  onToggle: () => void
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <IssueCard
        issue={issue}
        members={members}
        selected={selected}
        onToggle={onToggle}
        onClick={onClick}
        isDragging={isDragging}
      />
    </div>
  )
}

/* ── IssueCard ────────────────────────────────────────────── */

function IssueCard({ issue, members, selected, onToggle, onClick, isDragging }: {
  issue: Issue
  members: Member[]
  selected: boolean
  onToggle: () => void
  onClick: () => void
  isDragging?: boolean
}) {
  const assignee = members.find(m => m.id === issue.assignee_id)

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors space-y-2 group",
        isDragging && "opacity-40 shadow-lg ring-1 ring-primary",
        selected && "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-start gap-1.5">
        {/* Checkbox / type icon toggle */}
        <div className="relative shrink-0 w-[13px] h-[13px] mt-0.5 flex items-center justify-center">
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
            onPointerDown={e => e.stopPropagation()} // prevent DnD activation
            onClick={e => e.stopPropagation()}       // prevent card click
            className={cn(
              "absolute inset-0 w-[13px] h-[13px] cursor-pointer accent-primary rounded transition-opacity",
              selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          />
        </div>
        <p className="text-[12.5px] leading-snug flex-1 line-clamp-2">{issue.title}</p>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-muted-foreground/40">
          {(issue as any).board?.key ?? ""}-{issue.issue_number}
        </span>
        <PriorityIcon priority={issue.priority} size={11} />
        {issue.story_points != null && (
          <span className="text-[10px] text-muted-foreground/50 ml-auto">{issue.story_points}sp</span>
        )}
        {assignee ? (
          <div
            className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[7px] font-semibold text-white ml-auto shrink-0"
            style={{ backgroundColor: assignee.avatar_color }}
            title={assignee.name}
          >
            {getInitials(assignee.name)}
          </div>
        ) : (
          <div className="ml-auto shrink-0 w-[18px] h-[18px] rounded-full border border-dashed border-border" />
        )}
      </div>

      {(issue.labels ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(issue.labels ?? []).map(l => (
            <span key={l} className="text-[9px] px-1.5 py-0.5 bg-secondary rounded-full text-muted-foreground">
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
