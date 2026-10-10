"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { WorkflowStatus } from "@/types/database"

type Board = { id: string; name: string; key?: string }

const CATEGORY_OPTIONS = [
  { value: "todo",        label: "To do",      color: "#6b6b6b" },
  { value: "in_progress", label: "In progress", color: "#5e6ad2" },
  { value: "done",        label: "Done",        color: "#26d97f" },
]

const PRESET_COLORS = [
  "#5e6ad2", "#26d97f", "#f5a524", "#f54260",
  "#8b5cf6", "#06b6d4", "#ec4899", "#6b7280",
  "#10b981", "#f97316", "#3b82f6", "#6b6b6b",
]

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
            value === c ? "border-foreground scale-110" : "border-transparent"
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

/* ── Status row ──────────────────────────────────────────────────── */

function StatusRow({
  status,
  onUpdate,
  onDelete,
  isOnly,
}: {
  status: WorkflowStatus
  onUpdate: (id: string, patch: Partial<WorkflowStatus>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  isOnly: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(status.name)
  const [color, setColor] = useState(status.color)
  const [category, setCategory] = useState(status.category)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    await onUpdate(status.id, { name: name.trim(), color, category })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="border border-border rounded-[6px] overflow-hidden">
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/30 transition-colors cursor-pointer"
        onClick={() => setEditing(e => !e)}
      >
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
        <span className="text-[13px] flex-1">{status.name}</span>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
          style={{ color: CATEGORY_OPTIONS.find(c => c.value === status.category)?.color ?? "#6b6b6b", backgroundColor: (CATEGORY_OPTIONS.find(c => c.value === status.category)?.color ?? "#6b6b6b") + "18" }}
        >
          {CATEGORY_OPTIONS.find(c => c.value === status.category)?.label ?? status.category}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={cn("text-muted-foreground/40 shrink-0 transition-transform", editing && "rotate-180")}
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="px-3 pb-3 pt-1 border-t border-border bg-secondary/10 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-8 px-3 text-[13px] bg-background border border-border rounded-[5px] focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Category</label>
            <div className="flex gap-2">
              {CATEGORY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value as WorkflowStatus["category"])}
                  className={cn(
                    "px-2.5 py-1 text-[11px] rounded-[5px] border transition-all",
                    category === opt.value
                      ? "border-transparent font-medium"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                  style={category === opt.value ? { color: opt.color, backgroundColor: opt.color + "18", borderColor: opt.color + "40" } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Color</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving || !name.trim()}
              className="h-7 px-3 text-[12px] bg-primary text-primary-foreground rounded-[5px] hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setName(status.name); setColor(status.color); setCategory(status.category) }}
              className="h-7 px-3 text-[12px] border border-border rounded-[5px] hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            {!isOnly && (
              <button
                onClick={() => onDelete(status.id)}
                className="h-7 px-3 text-[12px] text-red-400/70 hover:text-red-400 border border-border hover:border-red-400/40 rounded-[5px] transition-colors ml-auto"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Add status form ─────────────────────────────────────────────── */

function AddStatusForm({ boardId, onAdded }: { boardId: string; onAdded: (s: WorkflowStatus) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [color, setColor] = useState("#5e6ad2")
  const [category, setCategory] = useState<WorkflowStatus["category"]>("todo")
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: boardId, name: name.trim(), color, category, position: 99 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onAdded(data)
      setName(""); setColor("#5e6ad2"); setCategory("todo"); setOpen(false)
      toast.success("Status added")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        Add status
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="border border-border rounded-[6px] px-3 pb-3 pt-2.5 space-y-3 bg-secondary/10">
      <p className="text-[12px] font-medium">New status</p>
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Name</label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. In Review"
          className="w-full h-8 px-3 text-[13px] bg-background border border-border rounded-[5px] focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Category</label>
        <div className="flex gap-2">
          {CATEGORY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCategory(opt.value as WorkflowStatus["category"])}
              className={cn(
                "px-2.5 py-1 text-[11px] rounded-[5px] border transition-all",
                category === opt.value ? "border-transparent font-medium" : "border-border text-muted-foreground hover:text-foreground"
              )}
              style={category === opt.value ? { color: opt.color, backgroundColor: opt.color + "18", borderColor: opt.color + "40" } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Color</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !name.trim()}
          className="h-7 px-3 text-[12px] bg-primary text-primary-foreground rounded-[5px] hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {saving ? "Adding…" : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="h-7 px-3 text-[12px] border border-border rounded-[5px] hover:bg-secondary transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

/* ── Main Board Settings panel ───────────────────────────────────── */

export function BoardSettings({
  board,
  statuses: initialStatuses,
  isAdmin,
  onBoardUpdated,
}: {
  board: Board
  statuses: WorkflowStatus[]
  isAdmin: boolean
  onBoardUpdated?: (b: Board) => void
}) {
  const [open, setOpen] = useState(false)
  const [statuses, setStatuses] = useState<WorkflowStatus[]>(initialStatuses)
  const [boardName, setBoardName] = useState(board.name)
  const [savingName, setSavingName] = useState(false)
  const [activeTab, setActiveTab] = useState<"statuses" | "general">("statuses")
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  async function saveBoardName() {
    if (!boardName.trim() || boardName === board.name) return
    setSavingName(true)
    try {
      const res = await fetch(`/api/boards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: boardName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Board renamed")
      onBoardUpdated?.({ ...board, name: boardName.trim() })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setSavingName(false)
    }
  }

  async function updateStatus(id: string, patch: Partial<WorkflowStatus>) {
    const res = await fetch("/api/workflow", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); return }
    setStatuses(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
    toast.success("Status updated")
  }

  async function deleteStatus(id: string) {
    const res = await fetch(`/api/workflow?id=${id}`, { method: "DELETE" })
    if (!res.ok) { const d = await res.json(); toast.error(d.error); return }
    setStatuses(prev => prev.filter(s => s.id !== id))
    toast.success("Status deleted")
  }

  if (!isAdmin) return null

  return (
    <div className="relative" ref={panelRef}>
      {/* Gear trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center transition-colors shrink-0",
          open
            ? "bg-secondary text-foreground"
            : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary/60"
        )}
        title="Board settings"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5.2-1a5.3 5.3 0 0 0 .05-.7v-.6a5.3 5.3 0 0 0-.05-.7l1.5-1.2a.4.4 0 0 0 .1-.5l-1.4-2.4a.4.4 0 0 0-.5-.15l-1.8.72a5.5 5.5 0 0 0-1.2-.7L9.6 1.4A.4.4 0 0 0 9.2 1h-2.4a.4.4 0 0 0-.4.34l-.27 1.9a5.5 5.5 0 0 0-1.2.7l-1.77-.72a.4.4 0 0 0-.5.15L1.23 5.8a.39.39 0 0 0 .1.5l1.5 1.2A5.5 5.5 0 0 0 2.77 8v.6a5.3 5.3 0 0 0 .05.7l-1.5 1.2a.4.4 0 0 0-.1.5l1.4 2.4c.1.18.32.24.5.15l1.77-.72a5.5 5.5 0 0 0 1.2.7l.27 1.9c.05.2.22.34.4.34h2.4c.18 0 .35-.14.4-.34l.27-1.9a5.5 5.5 0 0 0 1.2-.7l1.77.72c.18.1.4.03.5-.15l1.4-2.4a.39.39 0 0 0-.1-.5l-1.5-1.2Z"
            stroke="currentColor" strokeWidth="1.3"
          />
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-9 w-[340px] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-[13px] font-semibold">Board settings</p>
            <button onClick={() => setOpen(false)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border px-4">
            {(["statuses", "general"] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={cn(
                  "px-1 py-2.5 text-[12px] mr-4 border-b-2 -mb-px transition-colors capitalize",
                  activeTab === t ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
            {activeTab === "statuses" && (
              <>
                <p className="text-[11px] text-muted-foreground">
                  Statuses define your workflow. Drag to reorder, click to edit.
                </p>
                <div className="space-y-2">
                  {statuses.map(s => (
                    <StatusRow
                      key={s.id}
                      status={s}
                      onUpdate={updateStatus}
                      onDelete={deleteStatus}
                      isOnly={statuses.length <= 1}
                    />
                  ))}
                </div>
                <AddStatusForm boardId={board.id} onAdded={s => setStatuses(prev => [...prev, s])} />
              </>
            )}

            {activeTab === "general" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Board name</label>
                  <div className="flex gap-2">
                    <input
                      value={boardName}
                      onChange={e => setBoardName(e.target.value)}
                      className="flex-1 h-8 px-3 text-[13px] bg-secondary border border-border rounded-[5px] focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    <button
                      onClick={saveBoardName}
                      disabled={savingName || !boardName.trim() || boardName === board.name}
                      className="h-8 px-3 text-[12px] bg-primary text-primary-foreground rounded-[5px] hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {savingName ? "…" : "Save"}
                    </button>
                  </div>
                </div>

                {board.key && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Board key</label>
                    <div className="h-8 px-3 flex items-center text-[13px] font-mono bg-secondary/40 border border-border rounded-[5px] text-muted-foreground">
                      {board.key}
                    </div>
                    <p className="text-[10px] text-muted-foreground/50">Board key cannot be changed after creation.</p>
                  </div>
                )}

                <div className="pt-1 border-t border-border">
                  <p className="text-[11px] font-medium text-muted-foreground mb-2">Workflow categories</p>
                  <div className="space-y-1.5">
                    {CATEGORY_OPTIONS.map(c => (
                      <div key={c.value} className="flex items-center gap-2.5 text-[12px]">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="flex-1">{c.label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {statuses.filter(s => s.category === c.value).length} status{statuses.filter(s => s.category === c.value).length !== 1 ? "es" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
