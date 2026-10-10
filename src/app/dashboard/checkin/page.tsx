"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { IssueTypeIcon, PriorityIcon } from "@/components/board/IssueTypeBadge"

type TaggedIssue = { issue_id: string; note: string }

type Issue = {
  id: string
  title: string
  issue_number: number | null
  type: string
  priority: string
  due_date: string | null
  workflow_status: { id: string; name: string; color: string; category: string } | null
}

const AVAILABILITY_OPTIONS = [
  { value: "working", label: "Full day", dot: "#26d97f" },
  { value: "half_day", label: "Half day", dot: "#f5a524" },
  { value: "remote", label: "Remote", dot: "#5e6ad2" },
]

export default function CheckinPage() {
  const router = useRouter()
  const [tagged, setTagged] = useState<TaggedIssue[]>([])
  const [allIssues, setAllIssues] = useState<Issue[]>([])
  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [todayPlan, setTodayPlan] = useState("")
  const [hasBlocker, setHasBlocker] = useState(false)
  const [blockers, setBlockers] = useState("")
  const [hasRisk, setHasRisk] = useState(false)
  const [riskNote, setRiskNote] = useState("")
  const [availability, setAvailability] = useState("working")
  const [existing, setExisting] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, team_id")
        .eq("id", user.id)
        .single()

      if (profile?.role === "admin") { router.replace("/dashboard"); return }

      const today = (await import("@/lib/date")).todayIST()

      const [{ data: checkin }, { data: issues }] = await Promise.all([
        supabase
          .from("checkins")
          .select("id, tagged_issues, blockers, availability, todos, risk, risk_note")
          .eq("user_id", user.id)
          .eq("checkin_date", today)
          .maybeSingle(),
        supabase
          .from("issues")
          .select("id, title, issue_number, type, priority, due_date, workflow_status:status_id(id, name, color, category)")
          .eq("assignee_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(100),
      ])

      // Filter out done issues client-side (can't filter on joined cols in PostgREST)
      const open = ((issues ?? []) as unknown as Issue[]).filter(
        i => i.workflow_status?.category !== "done"
      )
      setAllIssues(open)

      if (checkin) {
        setExisting({ id: checkin.id })
        setTagged((checkin.tagged_issues as TaggedIssue[]) ?? [])
        const blk = checkin.blockers ?? ""
        setBlockers(blk)
        setHasBlocker(!!blk.trim())
        setAvailability(checkin.availability ?? "working")
        setTodayPlan((checkin as any).todos ?? "")
        setHasRisk(!!(checkin as any).risk)
        setRiskNote((checkin as any).risk_note ?? "")
      }
      setFetching(false)
    }
    load()
  }, [router])

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSearch(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  function tagIssue(issue: Issue) {
    if (tagged.find(t => t.issue_id === issue.id)) return
    setTagged(prev => [...prev, { issue_id: issue.id, note: "" }])
    setSearch("")
    setShowSearch(false)
  }

  const filteredIssues = allIssues.filter(i => {
    if (tagged.find(t => t.issue_id === i.id)) return false
    const q = search.toLowerCase()
    return !q || i.title.toLowerCase().includes(q) || String(i.issue_number ?? "").includes(q)
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (tagged.length === 0) {
      toast.error("Tag at least one ticket you're working on today")
      return
    }
    if (!todayPlan.trim()) {
      toast.error("Add what will be done by EOD today")
      return
    }
    if (hasBlocker && !blockers.trim()) {
      toast.error("Describe the blocker, who can unblock it, and by when")
      return
    }
    if (hasRisk && !riskNote.trim()) {
      toast.error("Add a one-line reason for the timeline risk")
      return
    }
    setLoading(true)
    try {
      // Auto-generate plain-text todos for backward-compat with admin overview
      // Use user-written plan; fall back to auto-generated from tagged tickets
      const todosText = todayPlan.trim() ||
        tagged.map(t => {
          const issue = allIssues.find(i => i.id === t.issue_id)
          return issue
            ? `${issue.issue_number ? "#" + issue.issue_number + " · " : ""}${issue.title}`
            : t.issue_id
        }).join("\n")

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          todos: todosText,
          tagged_issues: tagged,
          blockers: hasBlocker ? (blockers.trim() || null) : null,
          risk: hasRisk,
          risk_note: hasRisk ? (riskNote.trim() || null) : null,
          availability,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      toast.success(existing ? "Check-in updated!" : "Morning check-in submitted!")
      router.push("/dashboard")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const isWeekend = [0, 6].includes(new Date().getDay())

  if (fetching) {
    return (
      <div className="max-w-2xl space-y-3">
        <div className="h-6 w-52 bg-card border border-border rounded animate-pulse" />
        <div className="h-3 w-72 bg-card border border-border rounded animate-pulse" />
        <div className="mt-4 bg-card border border-border rounded-lg h-48 animate-pulse" />
        <div className="bg-card border border-border rounded-lg h-16 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-5 md:p-6 lg:p-8">
    <div className="max-w-2xl">
      <div className="mb-5">
        <h1 className="text-[15px] font-semibold">Morning check-in</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Tag your tickets and set your availability for today
        </p>
      </div>

      {isWeekend && (
        <div className="bg-[#f5a524]/10 border border-[#f5a524]/20 rounded-lg px-3 py-2.5 mb-4">
          <p className="text-[12px] text-[#f5a524]">It&apos;s the weekend - logging anyway?</p>
        </div>
      )}
      {existing && (
        <div className="bg-primary/8 border border-primary/20 rounded-lg px-3 py-2.5 mb-4">
          <p className="text-[12px] text-primary">Already checked in today - updating your check-in.</p>
        </div>
      )}
      <div className="flex items-center gap-1.5 mb-4">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted-foreground/50 shrink-0">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M6 5.5v3M6 4v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <p className="text-[11px] text-muted-foreground/50">Best submitted before 11 AM IST</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="bg-card border border-border rounded-lg p-4 space-y-5">

          {/* ── Availability ─────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Availability
            </label>
            <div className="flex gap-2 flex-wrap">
              {AVAILABILITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAvailability(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12px] border transition-all ${availability === opt.value
                      ? "border-transparent bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: opt.dot }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── What will be DONE by EOD today ───────────── */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              What will be DONE by EOD today? <span className="text-destructive">*</span>
            </label>
            <textarea
              placeholder="Add specific goals/deliverables for the task — e.g. 'Dark mode toggle merged to main', not 'working on dark mode'"
              value={todayPlan}
              onChange={e => setTodayPlan(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-[13px] bg-secondary border border-border rounded-[6px] resize-y min-h-[110px] focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
            />
          </div>

          {/* ── Ticket tagging ────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Tickets for today <span className="text-destructive">*</span>
            </label>

            {/* Tagged list */}
            {tagged.length > 0 && (
              <div className="space-y-1.5">
                {tagged.map(t => {
                  const issue = allIssues.find(i => i.id === t.issue_id)
                  if (!issue) return null
                  return (
                    <div key={t.issue_id} className="flex items-center gap-2.5 px-3 py-2 rounded-[6px] bg-secondary border border-border/60">
                      <IssueTypeIcon type={issue.type} size={13} />
                      {issue.issue_number && (
                        <span className="text-[11px] text-muted-foreground font-mono shrink-0">#{issue.issue_number}</span>
                      )}
                      <span className="text-[12px] flex-1 truncate">{issue.title}</span>
                      <span className={`text-[10px] shrink-0 ${issue.due_date ? "text-muted-foreground" : "text-muted-foreground/40"}`}
                        title="Target date">
                        {issue.due_date
                          ? `🎯 ${new Date(issue.due_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" })}`
                          : "No target"}
                      </span>
                      {issue.workflow_status && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: issue.workflow_status.color }} />
                          {issue.workflow_status.name}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setTagged(prev => prev.filter(x => x.issue_id !== t.issue_id))}
                        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add ticket dropdown */}
            <div ref={searchRef} className="relative">
              <button
                type="button"
                onClick={() => setShowSearch(s => !s)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-[6px] border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors text-[12px]"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {tagged.length === 0 ? "Add a ticket you're working on today" : "Add another ticket"}
              </button>

              {showSearch && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-[6px] shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-muted-foreground shrink-0">
                      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    <input
                      autoFocus
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search your tickets..."
                      className="flex-1 text-[13px] bg-transparent outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div className="max-h-[220px] overflow-y-auto">
                    {filteredIssues.length === 0 ? (
                      <p className="px-3 py-5 text-[12px] text-muted-foreground text-center">
                        {search ? "No matching tickets" : "No open tickets assigned to you"}
                      </p>
                    ) : (
                      filteredIssues.slice(0, 20).map(issue => (
                        <button
                          key={issue.id}
                          type="button"
                          onClick={() => tagIssue(issue)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-secondary transition-colors text-left group"
                        >
                          <IssueTypeIcon type={issue.type} size={13} />
                          <PriorityIcon priority={issue.priority} size={12} />
                          {issue.issue_number && (
                            <span className="text-[11px] text-muted-foreground font-mono shrink-0">#{issue.issue_number}</span>
                          )}
                          <span className="text-[12px] flex-1 truncate">{issue.title}</span>
                          {issue.workflow_status && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: issue.workflow_status.color }} />
                              {issue.workflow_status.name}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Risk to timeline ──────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Risk to timeline?
              </label>
              <YesNoToggle value={hasRisk} onChange={setHasRisk} />
            </div>
            {hasRisk && (
              <input
                autoFocus
                placeholder="One line: why is the timeline at risk?"
                value={riskNote}
                onChange={e => setRiskNote(e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-secondary border border-border rounded-[6px] focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
              />
            )}
          </div>

          {/* ── Blockers ──────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Blockers?
              </label>
              <YesNoToggle value={hasBlocker} onChange={setHasBlocker} />
            </div>
            {hasBlocker && (
              <textarea
                autoFocus
                placeholder="Mention the blocker, who can unblock it, and needed by (date/time)."
                value={blockers}
                onChange={e => setBlockers(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-[13px] bg-secondary border border-border rounded-[6px] resize-y min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            size="sm"
            className="h-8 text-[13px] px-4"
            disabled={loading || tagged.length === 0}
          >
            {loading ? "Submitting..." : existing ? "Update check-in" : "Submit check-in"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-[13px]"
            onClick={() => router.push("/dashboard")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
    </div>
  )
}

function YesNoToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[{ v: false, l: "No" }, { v: true, l: "Yes" }].map(opt => (
        <button
          key={opt.l}
          type="button"
          onClick={() => onChange(opt.v)}
          className={`px-3 py-1 rounded-[5px] text-[12px] border transition-all ${
            value === opt.v
              ? opt.v
                ? "border-transparent bg-[#f54260]/10 text-[#f54260] font-medium"
                : "border-transparent bg-primary/10 text-primary font-medium"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.l}
        </button>
      ))}
    </div>
  )
}
