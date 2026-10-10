"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Project, Milestone, Task, Profile, ProjectStatus, ProjectPriority, TaskStatus, TaskPriority } from "@/types/database"
import { todayIST } from "@/lib/date"

const PROJECT_COLORS = ["#5e6ad2","#26a69a","#ec4899","#f59e0b","#10b981","#6366f1","#f43f5e","#8b5cf6"]

const STATUS_PIPELINE: { value: ProjectStatus; label: string; color: string }[] = [
  { value: "backlog",     label: "Backlog",     color: "#6b6b6b" },
  { value: "active",      label: "Active",      color: "#5e6ad2" },
  { value: "qa",          label: "QA",          color: "#f5a524" },
  { value: "staging",     label: "Staging",     color: "#26a69a" },
  { value: "production",  label: "Production",  color: "#26d97f" },
  { value: "on_hold",     label: "On Hold",     color: "#8b8b8b" },
  { value: "done",        label: "Done",        color: "#3a3a3a" },
]

const PRIORITY_CONFIG: Record<ProjectPriority, { label: string; color: string }> = {
  low:      { label: "Low",      color: "#6b6b6b" },
  medium:   { label: "Medium",   color: "#5e6ad2" },
  high:     { label: "High",     color: "#f5a524" },
  critical: { label: "Critical", color: "#f54260" },
}

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  todo:        { label: "Todo",        color: "#6b6b6b" },
  in_progress: { label: "In Progress", color: "#5e6ad2" },
  done:        { label: "Done",        color: "#26d97f" },
  blocked:     { label: "Blocked",     color: "#f54260" },
}

const TASK_PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low:    { label: "Low",    color: "#6b6b6b" },
  medium: { label: "Medium", color: "#5e6ad2" },
  high:   { label: "High",   color: "#f5a524" },
}

interface EditState {
  name: string; desc: string; status: ProjectStatus
  priority: ProjectPriority; startDate: string; endDate: string; color: string
}

interface CompletionState {
  projectId: string
  notes: string
  shipDate: string
}

function daysUntil(date: string | null) {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

function DeadlineBadge({ date }: { date: string | null }) {
  if (!date) return null
  const days = daysUntil(date)!
  const isOverdue = days < 0
  const isSoon = !isOverdue && days <= 3
  const label = isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
      isOverdue
        ? "text-[#f54260] bg-[#f54260]/10"
        : isSoon
        ? "text-[#f5a524] bg-[#f5a524]/10"
        : "text-muted-foreground bg-secondary border border-border"
    }`}>
      {label}
    </span>
  )
}

function ProjectFormFields({ state, onChange }: { state: EditState; onChange: (patch: Partial<EditState>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Name</label>
        <Input placeholder="Auth redesign, Mobile v2..." value={state.name} onChange={(e) => onChange({ name: e.target.value })}
          required autoFocus className="bg-secondary border-border text-[13px] h-8" />
      </div>
      <div className="col-span-2 space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
          Description <span className="normal-case tracking-normal font-normal text-muted-foreground/60">(optional)</span>
        </label>
        <Textarea placeholder="What is this project about?" value={state.desc} onChange={(e) => onChange({ desc: e.target.value })}
          rows={2} className="bg-secondary border-border text-[13px] resize-none" />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Status</label>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_PIPELINE.map((s) => (
            <button key={s.value} type="button" onClick={() => onChange({ status: s.value })}
              className="text-[11px] px-2 py-1 rounded border transition-all"
              style={{
                borderColor: state.status === s.value ? s.color + "60" : "var(--border)",
                backgroundColor: state.status === s.value ? s.color + "15" : "var(--secondary)",
                color: state.status === s.value ? s.color : "var(--muted-foreground)",
              }}>{s.label}</button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Priority</label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(PRIORITY_CONFIG) as [ProjectPriority, { label: string; color: string }][]).map(([k, v]) => (
            <button key={k} type="button" onClick={() => onChange({ priority: k })}
              className="text-[11px] px-2 py-1 rounded border transition-all"
              style={{
                borderColor: state.priority === k ? v.color + "60" : "var(--border)",
                backgroundColor: state.priority === k ? v.color + "15" : "var(--secondary)",
                color: state.priority === k ? v.color : "var(--muted-foreground)",
              }}>{v.label}</button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Start date</label>
        <Input type="date" value={state.startDate} onChange={(e) => onChange({ startDate: e.target.value })}
          className="bg-secondary border-border text-[13px] h-8 dark:[color-scheme:dark]" />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Deadline</label>
        <Input type="date" value={state.endDate} onChange={(e) => onChange({ endDate: e.target.value })}
          className="bg-secondary border-border text-[13px] h-8 dark:[color-scheme:dark]" />
      </div>
      <div className="col-span-2 space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Color</label>
        <div className="flex gap-2 mt-1">
          {PROJECT_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => onChange({ color: c })} className="w-5 h-5 rounded-full transition-all"
              style={{
                backgroundColor: c,
                transform: state.color === c ? "scale(1.25)" : "scale(1)",
                boxShadow: state.color === c ? `0 0 0 2px var(--card), 0 0 0 3.5px ${c}` : "none",
              }} />
          ))}
        </div>
      </div>
    </div>
  )
}

type ProjectFull = Project & { milestones: Milestone[]; tasks: Task[] }

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectFull[]>([])
  const [archivedProjects, setArchivedProjects] = useState<ProjectFull[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [teamId, setTeamId] = useState("")
  const [currentUserId, setCurrentUserId] = useState("")
  const [tab, setTab] = useState<"active" | "archive">("active")

  // Create
  const [creating, setCreating] = useState(false)
  const [createState, setCreateState] = useState<EditState>({ name: "", desc: "", color: PROJECT_COLORS[0], status: "active", priority: "medium", startDate: "", endDate: "" })
  const [saving, setSaving] = useState(false)

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Expand
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedTab, setExpandedTab] = useState<Record<string, "milestones" | "tasks">>({})

  // Milestone state
  const [newMilestone, setNewMilestone] = useState<Record<string, string>>({})
  const [editMilestoneId, setEditMilestoneId] = useState<string | null>(null)
  const [editMilestoneTitle, setEditMilestoneTitle] = useState("")
  const milestoneInputRef = useRef<HTMLInputElement>(null)

  // Task state
  const [newTaskTitle, setNewTaskTitle] = useState<Record<string, string>>({})
  const [newTaskAssignee, setNewTaskAssignee] = useState<Record<string, string>>({})
  const [newTaskPriority, setNewTaskPriority] = useState<Record<string, TaskPriority>>({})

  // Completion modal
  const [completionState, setCompletionState] = useState<CompletionState | null>(null)
  const [completionSaving, setCompletionSaving] = useState(false)

  // Restore
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", user.id).single()
    if (!profile?.team_id) return
    setTeamId(profile.team_id)

    const [{ data: activeProjs }, { data: archivedProjs }, { data: milestones }, { data: tasks }, { data: mems }] = await Promise.all([
      supabase.from("projects").select("*").eq("team_id", profile.team_id).eq("is_active", true).order("created_at"),
      supabase.from("projects").select("*").eq("team_id", profile.team_id).eq("is_active", false).order("created_at", { ascending: false }),
      supabase.from("milestones").select("*").eq("team_id", profile.team_id).order("sort_order"),
      supabase.from("tasks").select("*").eq("team_id", profile.team_id).order("created_at"),
      supabase.from("profiles").select("id, name, avatar_color").eq("team_id", profile.team_id).eq("is_active", true).order("name"),
    ])

    const enrich = (p: Project): ProjectFull => ({
      ...p,
      milestones: (milestones ?? []).filter((m) => m.project_id === p.id),
      tasks: (tasks ?? []).filter((t) => t.project_id === p.id),
    })

    setProjects((activeProjs ?? []).map(enrich))
    setArchivedProjects((archivedProjs ?? []).map(enrich))
    setMembers((mems ?? []) as Profile[])
    setLoading(false)
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!createState.name.trim() || !teamId) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from("projects").insert({
      name: createState.name.trim(), description: createState.desc.trim() || null,
      color: createState.color, status: createState.status, priority: createState.priority,
      start_date: createState.startDate || null, end_date: createState.endDate || null, team_id: teamId,
    }).select().single()
    if (error) { toast.error(error.message); setSaving(false); return }
    setProjects((prev) => [...prev, { ...data, milestones: [], tasks: [] }])
    setCreateState({ name: "", desc: "", color: PROJECT_COLORS[0], status: "active", priority: "medium", startDate: "", endDate: "" })
    setCreating(false)
    toast.success("Project created")
    setSaving(false)
  }

  function startEdit(project: ProjectFull) {
    setEditingId(project.id)
    setExpandedId(null)
    setDeleteConfirmId(null)
    setEditState({
      name: project.name, desc: project.description ?? "", color: project.color,
      status: project.status, priority: project.priority,
      startDate: project.start_date ?? "", endDate: project.end_date ?? "",
    })
  }

  async function saveEdit(projectId: string) {
    if (!editState || !editState.name.trim()) return
    setEditSaving(true)
    const supabase = createClient()

    // If moving to done, open completion modal instead of saving directly
    const project = projects.find((p) => p.id === projectId)
    if (editState.status === "done" && project?.status !== "done") {
      setEditSaving(false)
      setCompletionState({ projectId, notes: "", shipDate: todayIST() })
      return
    }

    const { data, error } = await supabase.from("projects").update({
      name: editState.name.trim(), description: editState.desc.trim() || null,
      color: editState.color, status: editState.status, priority: editState.priority,
      start_date: editState.startDate || null, end_date: editState.endDate || null,
    }).eq("id", projectId).select().single()
    if (error) { toast.error(error.message); setEditSaving(false); return }
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, ...data } : p))
    setEditingId(null); setEditState(null)
    toast.success("Project updated")
    setEditSaving(false)
  }

  async function completeProject() {
    if (!completionState) return
    setCompletionSaving(true)
    const supabase = createClient()
    const editData = editState
    const projectId = completionState.projectId

    const { data, error } = await supabase.from("projects").update({
      ...(editData ? {
        name: editData.name.trim(), description: editData.desc.trim() || null,
        color: editData.color, priority: editData.priority,
        start_date: editData.startDate || null, end_date: editData.endDate || null,
      } : {}),
      status: "done",
      completed_at: new Date().toISOString(),
      completion_notes: completionState.notes.trim() || null,
    }).eq("id", projectId).select().single()

    if (error) { toast.error(error.message); setCompletionSaving(false); return }
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, ...data } : p))
    setEditingId(null); setEditState(null)
    setCompletionState(null)
    toast.success("Project marked as done!")
    setCompletionSaving(false)
  }

  async function updateStatus(projectId: string, newStatus: ProjectStatus) {
    if (newStatus === "done") {
      setCompletionState({ projectId, notes: "", shipDate: todayIST() })
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from("projects").update({ status: newStatus }).eq("id", projectId)
    if (error) { toast.error(error.message); return }
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, status: newStatus } : p))
  }

  async function archiveProject(id: string) {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from("projects").update({ is_active: false }).eq("id", id)
    if (error) { toast.error(error.message); setDeleting(false); return }
    const project = projects.find((p) => p.id === id)
    if (project) setArchivedProjects((prev) => [project, ...prev])
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setDeleteConfirmId(null)
    toast.success("Project archived")
    setDeleting(false)
  }

  async function restoreProject(id: string) {
    setRestoring(id)
    const supabase = createClient()
    const { error } = await supabase.from("projects").update({ is_active: true }).eq("id", id)
    if (error) { toast.error(error.message); setRestoring(null); return }
    const project = archivedProjects.find((p) => p.id === id)
    if (project) setProjects((prev) => [...prev, { ...project, is_active: true }])
    setArchivedProjects((prev) => prev.filter((p) => p.id !== id))
    toast.success("Project restored")
    setRestoring(null)
  }

  // Milestone ops
  async function addMilestone(projectId: string) {
    const title = newMilestone[projectId]?.trim()
    if (!title) return
    const supabase = createClient()
    const { data, error } = await supabase.from("milestones")
      .insert({ project_id: projectId, team_id: teamId, title, sort_order: Date.now() }).select().single()
    if (error) { toast.error(error.message); return }
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, milestones: [...p.milestones, data] } : p))
    setNewMilestone((prev) => ({ ...prev, [projectId]: "" }))
  }

  async function toggleMilestone(projectId: string, milestone: Milestone) {
    const supabase = createClient()
    const isDone = !milestone.is_done
    const { error } = await supabase.from("milestones")
      .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null }).eq("id", milestone.id)
    if (error) { toast.error(error.message); return }
    setProjects((prev) => prev.map((p) => p.id === projectId ? {
      ...p, milestones: p.milestones.map((m) => m.id === milestone.id
        ? { ...m, is_done: isDone, done_at: isDone ? new Date().toISOString() : null } : m),
    } : p))
  }

  function startRenameMilestone(milestone: Milestone) {
    setEditMilestoneId(milestone.id)
    setEditMilestoneTitle(milestone.title)
    setTimeout(() => milestoneInputRef.current?.focus(), 50)
  }

  async function saveMilestoneRename(projectId: string, milestoneId: string) {
    const title = editMilestoneTitle.trim()
    if (!title) { setEditMilestoneId(null); return }
    const supabase = createClient()
    const { error } = await supabase.from("milestones").update({ title }).eq("id", milestoneId)
    if (error) { toast.error(error.message); return }
    setProjects((prev) => prev.map((p) => p.id === projectId ? {
      ...p, milestones: p.milestones.map((m) => m.id === milestoneId ? { ...m, title } : m),
    } : p))
    setEditMilestoneId(null)
  }

  async function deleteMilestone(projectId: string, milestoneId: string) {
    const supabase = createClient()
    const { error } = await supabase.from("milestones").delete().eq("id", milestoneId)
    if (error) { toast.error(error.message); return }
    setProjects((prev) => prev.map((p) => p.id === projectId
      ? { ...p, milestones: p.milestones.filter((m) => m.id !== milestoneId) } : p))
  }

  // Task ops
  async function addTask(projectId: string) {
    const title = newTaskTitle[projectId]?.trim()
    if (!title) return
    const supabase = createClient()
    const { data, error } = await supabase.from("tasks").insert({
      project_id: projectId,
      team_id: teamId,
      title,
      status: "todo",
      priority: newTaskPriority[projectId] ?? "medium",
      assigned_to: newTaskAssignee[projectId] || null,
      created_by: currentUserId,
    }).select().single()
    if (error) { toast.error(error.message); return }
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, tasks: [...p.tasks, data as Task] } : p))
    setNewTaskTitle((prev) => ({ ...prev, [projectId]: "" }))
    setNewTaskAssignee((prev) => ({ ...prev, [projectId]: "" }))
    setNewTaskPriority((prev) => ({ ...prev, [projectId]: "medium" }))
  }

  async function cycleTaskStatus(projectId: string, task: Task) {
    const order: TaskStatus[] = ["todo", "in_progress", "done", "blocked"]
    const next = order[(order.indexOf(task.status) + 1) % order.length]
    const supabase = createClient()
    const { error } = await supabase.from("tasks").update({ status: next }).eq("id", task.id)
    if (error) { toast.error(error.message); return }
    setProjects((prev) => prev.map((p) => p.id === projectId
      ? { ...p, tasks: p.tasks.map((t) => t.id === task.id ? { ...t, status: next } : t) } : p))
  }

  async function deleteTask(projectId: string, taskId: string) {
    const supabase = createClient()
    const { error } = await supabase.from("tasks").delete().eq("id", taskId)
    if (error) { toast.error(error.message); return }
    setProjects((prev) => prev.map((p) => p.id === projectId
      ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) } : p))
  }

  const pipelineGroups = STATUS_PIPELINE.map((s) => ({
    ...s, projects: projects.filter((p) => p.status === s.value),
  })).filter((g) => g.projects.length > 0)

  const displayProjects = tab === "active" ? pipelineGroups : []

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold">Projects</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Manage your team&apos;s work pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex gap-0.5 bg-secondary/50 p-0.5 rounded-[6px]">
            {(["active", "archive"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1 text-[11px] font-medium rounded-[4px] transition-all capitalize ${
                  tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>
                {t === "archive" ? `Archive${archivedProjects.length > 0 ? ` (${archivedProjects.length})` : ""}` : "Active"}
              </button>
            ))}
          </div>
          {tab === "active" && !creating && (
            <Button size="sm" className="h-7 text-[12px]" onClick={() => setCreating(true)}>+ New project</Button>
          )}
        </div>
      </div>

      {/* Create form */}
      {creating && tab === "active" && (
        <form onSubmit={createProject} className="bg-card border border-border rounded-lg p-4 space-y-4">
          <p className="text-[13px] font-medium">New project</p>
          <ProjectFormFields state={createState} onChange={(patch) => setCreateState((s) => ({ ...s, ...patch }))} />
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" className="h-7 text-[12px]" disabled={saving || !createState.name.trim()}>
              {saving ? "Creating..." : "Create project"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[12px]"
              onClick={() => { setCreating(false); setCreateState({ name: "", desc: "", color: PROJECT_COLORS[0], status: "active", priority: "medium", startDate: "", endDate: "" }) }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Completion modal */}
      {completionState && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-5 w-full max-w-md space-y-4">
            <div>
              <p className="text-[14px] font-semibold">Mark project as done</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {projects.find((p) => p.id === completionState.projectId)?.name}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Completion notes <span className="normal-case tracking-normal font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <Textarea
                placeholder="What shipped? Key decisions made? Lessons learned?"
                value={completionState.notes}
                onChange={(e) => setCompletionState((s) => s ? { ...s, notes: e.target.value } : s)}
                rows={3}
                className="bg-secondary border-border text-[13px] resize-none"
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="h-8 text-[12px] bg-[#26d97f] hover:bg-[#26d97f]/90 text-black"
                onClick={completeProject} disabled={completionSaving}>
                {completionSaving ? "Saving..." : "Mark as done"}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-[12px]"
                onClick={() => setCompletionState(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map((i) => <div key={i} className="h-20 bg-card border border-border rounded-lg animate-pulse" />)}
        </div>
      ) : tab === "archive" ? (
        /* ── Archive tab ─────────────────────────────────────── */
        <div>
          {archivedProjects.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <p className="text-[13px] text-muted-foreground">No archived projects.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Archived · {archivedProjects.length}
                </p>
              </div>
              <div className="divide-y divide-border">
                {archivedProjects.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium">{p.name}</p>
                      {p.completion_notes && (
                        <p className="text-[11px] text-muted-foreground truncate">{p.completion_notes}</p>
                      )}
                    </div>
                    {p.completed_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        Done {new Date(p.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" })}
                      </span>
                    )}
                    <button
                      onClick={() => restoreProject(p.id)}
                      disabled={restoring === p.id}
                      className="text-[11px] text-muted-foreground hover:text-primary border border-border px-2.5 py-1 rounded transition-colors hover:border-primary/40 disabled:opacity-50 shrink-0"
                    >
                      {restoring === p.id ? "Restoring..." : "Restore"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-[13px] text-muted-foreground">No projects yet. Create your first one above.</p>
        </div>
      ) : (
        /* ── Active pipeline ─────────────────────────────────── */
        <div className="space-y-4">
          {displayProjects.map((group) => (
            <div key={group.value}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{group.label}</p>
                <span className="text-[10px] text-muted-foreground/60">{group.projects.length}</span>
              </div>

              <div className="space-y-2">
                {group.projects.map((project) => {
                  const totalMs = project.milestones.length
                  const doneMs = project.milestones.filter((m) => m.is_done).length
                  const totalTasks = project.tasks.length
                  const doneTasks = project.tasks.filter((t) => t.status === "done").length
                  const pct = totalMs > 0 ? Math.round((doneMs / totalMs) * 100) : null
                  const isExpanded = expandedId === project.id && editingId !== project.id
                  const isEditing = editingId === project.id
                  const isDeleteConfirm = deleteConfirmId === project.id
                  const activeTab = expandedTab[project.id] ?? "milestones"

                  return (
                    <div key={project.id} className="bg-card border border-border rounded-lg overflow-hidden">
                      {/* Project row */}
                      <div className="group flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          onClick={() => { if (isEditing || isDeleteConfirm) return; setExpandedId(isExpanded ? null : project.id) }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[13px] font-medium">{project.name}</p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                project.priority === "critical" ? "text-[#f54260] bg-[#f54260]/10" :
                                project.priority === "high"     ? "text-[#f5a524] bg-[#f5a524]/10" :
                                project.priority === "medium"   ? "text-primary bg-primary/10" :
                                "text-muted-foreground bg-secondary border border-border"
                              }`}>
                                {PRIORITY_CONFIG[project.priority].label}
                              </span>
                              <DeadlineBadge date={project.end_date} />
                              {totalTasks > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {doneTasks}/{totalTasks} tasks
                                </span>
                              )}
                            </div>
                            {project.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{project.description}</p>
                            )}
                          </div>
                          {pct !== null && (
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: project.color }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                            </div>
                          )}
                        </div>

                        {/* Hover actions */}
                        <div className="flex items-center gap-0.5 shrink-0 opacity-30 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); startEdit(project) }} title="Edit"
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(project.id); setEditingId(null); setExpandedId(null) }} title="Archive"
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-[#f54260] transition-colors">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2 3h8M4.5 3V2h3v1M5 5.5v3M7 5.5v3M3.5 3l.5 7h4l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>

                        {!isEditing && !isDeleteConfirm && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                            className={`shrink-0 text-muted-foreground/40 transition-transform cursor-pointer ${isExpanded ? "rotate-180" : ""}`}
                            onClick={() => setExpandedId(isExpanded ? null : project.id)}>
                            <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* Archive confirm */}
                      {isDeleteConfirm && (
                        <div className="border-t border-border px-4 py-3 bg-[#f54260]/5">
                          <p className="text-[12px] font-medium text-foreground mb-1">Archive &ldquo;{project.name}&rdquo;?</p>
                          <p className="text-[11px] text-muted-foreground mb-3">
                            The project will be hidden from active view. You can restore it from the Archive tab.
                          </p>
                          <div className="flex gap-2">
                            <button onClick={() => archiveProject(project.id)} disabled={deleting}
                              className="text-[11px] font-medium px-3 py-1.5 rounded bg-[#f54260]/10 text-[#f54260] hover:bg-[#f54260]/20 transition-colors disabled:opacity-50">
                              {deleting ? "Archiving..." : "Yes, archive"}
                            </button>
                            <button onClick={() => setDeleteConfirmId(null)}
                              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Edit panel */}
                      {isEditing && editState && (
                        <div className="border-t border-border px-4 py-4 space-y-4">
                          <p className="text-[12px] font-medium text-muted-foreground">Edit project</p>
                          <ProjectFormFields state={editState} onChange={(patch) => setEditState((s) => s ? { ...s, ...patch } : s)} />
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" className="h-7 text-[12px]" disabled={editSaving || !editState.name.trim()}
                              onClick={() => saveEdit(project.id)}>
                              {editSaving ? "Saving..." : "Save changes"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-[12px]"
                              onClick={() => { setEditingId(null); setEditState(null) }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Expanded panel */}
                      {isExpanded && !isEditing && (
                        <div className="border-t border-border">
                          {/* Move status */}
                          <div className="px-4 pt-3 pb-2">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Move to</p>
                            <div className="flex flex-wrap gap-1.5">
                              {STATUS_PIPELINE.filter((s) => s.value !== project.status).map((s) => (
                                <button key={s.value} onClick={() => updateStatus(project.id, s.value)}
                                  className="text-[11px] px-2 py-1 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Sub-tab: Milestones / Tasks */}
                          <div className="px-4 pb-2 flex gap-1 border-b border-border">
                            {(["milestones", "tasks"] as const).map((t) => (
                              <button key={t} onClick={() => setExpandedTab((prev) => ({ ...prev, [project.id]: t }))}
                                className={`text-[11px] font-medium px-2.5 py-1 rounded-[4px] transition-colors capitalize ${
                                  activeTab === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                                }`}>
                                {t === "tasks" ? `Tasks${totalTasks > 0 ? ` (${totalTasks})` : ""}` : `Milestones${totalMs > 0 ? ` (${totalMs})` : ""}`}
                              </button>
                            ))}
                          </div>

                          {/* Milestones sub-panel */}
                          {activeTab === "milestones" && (
                            <div className="px-4 py-3 space-y-3">
                              {project.milestones.length > 0 && (
                                <div className="space-y-1">
                                  {project.milestones.map((m) => (
                                    <div key={m.id} className="flex items-center gap-2 group/m">
                                      <button onClick={() => toggleMilestone(project.id, m)}
                                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${m.is_done ? "bg-[#26d97f] border-[#26d97f]" : "border-border hover:border-muted-foreground"}`}>
                                        {m.is_done && (
                                          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                            <path d="M1.5 4.5l2 2 4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                        )}
                                      </button>
                                      {editMilestoneId === m.id ? (
                                        <input ref={milestoneInputRef} value={editMilestoneTitle}
                                          onChange={(e) => setEditMilestoneTitle(e.target.value)}
                                          onBlur={() => saveMilestoneRename(project.id, m.id)}
                                          onKeyDown={(e) => { if (e.key === "Enter") saveMilestoneRename(project.id, m.id); if (e.key === "Escape") setEditMilestoneId(null) }}
                                          className="flex-1 text-[12px] bg-secondary border border-border rounded px-1.5 py-0.5 outline-none focus:border-primary/50" />
                                      ) : (
                                        <span className={`text-[12px] flex-1 cursor-text ${m.is_done ? "line-through text-muted-foreground" : ""}`}
                                          onDoubleClick={() => startRenameMilestone(m)} title="Double-click to rename">
                                          {m.title}
                                        </span>
                                      )}
                                      <div className="flex items-center gap-0.5 opacity-20 group-hover/m:opacity-100 transition-opacity">
                                        <button onClick={() => startRenameMilestone(m)} className="text-muted-foreground hover:text-foreground p-0.5 transition-colors">
                                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                            <path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                                          </svg>
                                        </button>
                                        <button onClick={() => deleteMilestone(project.id, m.id)} className="text-muted-foreground hover:text-[#f54260] p-0.5 transition-colors">
                                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Input placeholder="Add milestone..." value={newMilestone[project.id] ?? ""}
                                  onChange={(e) => setNewMilestone((prev) => ({ ...prev, [project.id]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMilestone(project.id) } }}
                                  className="bg-secondary border-border text-[12px] h-7 flex-1" />
                                <Button size="sm" variant="outline" className="h-7 text-[11px] px-2"
                                  onClick={() => addMilestone(project.id)} disabled={!newMilestone[project.id]?.trim()}>
                                  Add
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Tasks sub-panel */}
                          {activeTab === "tasks" && (
                            <div className="px-4 py-3 space-y-3">
                              {project.tasks.length > 0 && (
                                <div className="space-y-1">
                                  {project.tasks.map((task) => {
                                    const assignee = members.find((m) => m.id === task.assigned_to)
                                    const sc = TASK_STATUS_CONFIG[task.status]
                                    const pc = TASK_PRIORITY_CONFIG[task.priority]
                                    return (
                                      <div key={task.id} className="flex items-center gap-2 group/t py-0.5">
                                        <button onClick={() => cycleTaskStatus(project.id, task)}
                                          title={`Status: ${sc.label} (click to cycle)`}
                                          className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all"
                                          style={{
                                            borderColor: task.status === "done" ? "#26d97f" : sc.color + "60",
                                            backgroundColor: task.status === "done" ? "#26d97f" : sc.color + "18",
                                          }}>
                                          {task.status === "done" && (
                                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                              <path d="M1.5 4.5l2 2 4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                          )}
                                        </button>
                                        <span className={`text-[12px] flex-1 ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                                          {task.title}
                                        </span>
                                        <span className={`text-[10px] font-medium shrink-0 ${
                                          task.priority === "high" ? "text-[#f5a524]" :
                                          task.priority === "medium" ? "text-primary" :
                                          "text-muted-foreground"
                                        }`}>{pc.label}</span>
                                        {assignee && (
                                          <div
                                            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                                            style={{ backgroundColor: assignee.avatar_color ?? "#5e6ad2" }}
                                            title={assignee.name}
                                          >
                                            {assignee.name[0].toUpperCase()}
                                          </div>
                                        )}
                                        <button onClick={() => deleteTask(project.id, task.id)}
                                          className="opacity-20 group-hover/t:opacity-100 text-muted-foreground hover:text-[#f54260] p-0.5 transition-all">
                                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                                          </svg>
                                        </button>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                              {/* Add task form */}
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <Input placeholder="Add task..." value={newTaskTitle[project.id] ?? ""}
                                    onChange={(e) => setNewTaskTitle((prev) => ({ ...prev, [project.id]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTask(project.id) } }}
                                    className="bg-secondary border-border text-[12px] h-7 flex-1" />
                                  <Button size="sm" variant="outline" className="h-7 text-[11px] px-2"
                                    onClick={() => addTask(project.id)} disabled={!newTaskTitle[project.id]?.trim()}>
                                    Add
                                  </Button>
                                </div>
                                <div className="flex gap-2">
                                  {/* Priority picker */}
                                  <div className="flex gap-1">
                                    {(Object.entries(TASK_PRIORITY_CONFIG) as [TaskPriority, { label: string; color: string }][]).map(([k, v]) => (
                                      <button key={k} type="button"
                                        onClick={() => setNewTaskPriority((prev) => ({ ...prev, [project.id]: k }))}
                                        className="text-[10px] px-2 py-0.5 rounded border transition-all"
                                        style={{
                                          borderColor: (newTaskPriority[project.id] ?? "medium") === k ? v.color + "60" : "var(--border)",
                                          backgroundColor: (newTaskPriority[project.id] ?? "medium") === k ? v.color + "15" : "var(--secondary)",
                                          color: (newTaskPriority[project.id] ?? "medium") === k ? v.color : "var(--muted-foreground)",
                                        }}>
                                        {v.label}
                                      </button>
                                    ))}
                                  </div>
                                  {/* Assignee picker */}
                                  {members.length > 0 && (
                                    <select value={newTaskAssignee[project.id] ?? ""}
                                      onChange={(e) => setNewTaskAssignee((prev) => ({ ...prev, [project.id]: e.target.value }))}
                                      className="h-6 px-1.5 text-[11px] bg-secondary border border-border rounded text-muted-foreground focus:outline-none">
                                      <option value="">Unassigned</option>
                                      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
