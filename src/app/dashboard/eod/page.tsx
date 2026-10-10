"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { IssueTypeIcon } from "@/components/board/IssueTypeBadge"

type Outcome = "done" | "in_progress" | "blocked" | "pushed"

type IssueOutcome = {
  issue_id: string
  outcome: Outcome
  note: string
}

type Issue = {
  id: string
  title: string
  issue_number: number | null
  type: string
  workflow_status: { name: string; color: string } | null
}

const OUTCOMES: { value: Outcome; label: string; color: string; bg: string }[] = [
  { value: "done", label: "Done", color: "#26d97f", bg: "#26d97f15" },
  { value: "in_progress", label: "In progress", color: "#5e6ad2", bg: "#5e6ad215" },
  { value: "blocked", label: "Blocked", color: "#f54260", bg: "#f5426015" },
  { value: "pushed", label: "Tomorrow", color: "#f5a524", bg: "#f5a52415" },
]

export default function EODPage() {
  const router = useRouter()
  const [outcomes, setOutcomes] = useState<IssueOutcome[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [hasSod, setHasSod] = useState<boolean | null>(null)   // null = loading
  const [existing, setExisting] = useState<{ id: string } | null>(null)
  const [overallNote, setOverallNote] = useState("")
  const [completionPct, setCompletionPct] = useState("")
  const [confidence, setConfidence] = useState<"high" | "medium" | "low" | "">("")
  const [hasRisk, setHasRisk] = useState(false)
  const [riskNote, setRiskNote] = useState("")
  const [qgMatchesPrd, setQgMatchesPrd] = useState(false)
  const [qgDevQa, setQgDevQa] = useState(false)
  const [qgNeedsReview, setQgNeedsReview] = useState(false)
  const [qgReviewWhatWhom, setQgReviewWhatWhom] = useState("")
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single()
      if (profile?.role === "admin") { router.replace("/dashboard"); return }

      const today = (await import("@/lib/date")).todayIST()

      const [{ data: checkin }, { data: eod }] = await Promise.all([
        supabase
          .from("checkins")
          .select("id, tagged_issues, todos")
          .eq("user_id", user.id)
          .eq("checkin_date", today)
          .maybeSingle(),
        supabase
          .from("eod_updates")
          .select("id, tagged_issues, accomplished, completion_pct, confidence, risk, risk_note, quality_gate")
          .eq("user_id", user.id)
          .eq("eod_date", today)
          .maybeSingle(),
      ])

      setHasSod(!!checkin)

      if (!checkin) { setFetching(false); return }

      // Get issue IDs from SOD
      const taggedInSod = (checkin.tagged_issues as { issue_id: string }[]) ?? []
      const issueIds = taggedInSod.map(t => t.issue_id).filter(Boolean)

      // Fetch issue details if any tagged
      let issueDetails: Issue[] = []
      if (issueIds.length > 0) {
        const { data } = await supabase
          .from("issues")
          .select("id, title, issue_number, type, workflow_status:status_id(name, color)")
          .in("id", issueIds)
        issueDetails = (data ?? []) as unknown as Issue[]
      }

      // Preserve SOD order
      const ordered = issueIds
        .map(id => issueDetails.find(i => i.id === id))
        .filter(Boolean) as Issue[]
      setIssues(ordered)

      if (eod) {
        setExisting({ id: eod.id })
        const savedOutcomes = (eod.tagged_issues as IssueOutcome[]) ?? []
        // Pre-fill saved outcomes, default remaining to "in_progress"
        const filled: IssueOutcome[] = ordered.map(issue => {
          const saved = savedOutcomes.find(o => o.issue_id === issue.id)
          return saved ?? { issue_id: issue.id, outcome: "in_progress", note: "" }
        })
        setOutcomes(filled)
        setOverallNote(eod.accomplished ?? "")
        const e = eod as any
        setCompletionPct(e.completion_pct != null ? String(e.completion_pct) : "")
        setConfidence(e.confidence ?? "")
        setHasRisk(!!e.risk)
        setRiskNote(e.risk_note ?? "")
        const qg = e.quality_gate ?? {}
        setQgMatchesPrd(!!qg.matches_prd)
        setQgDevQa(!!qg.dev_qa)
        setQgNeedsReview(!!qg.needs_review)
        setQgReviewWhatWhom(qg.review_what_whom ?? "")
      } else {
        // Default all to "done" as a starting point
        setOutcomes(ordered.map(issue => ({ issue_id: issue.id, outcome: "done", note: "" })))
      }

      setFetching(false)
    }
    load()
  }, [router])

  function setOutcome(issueId: string, outcome: Outcome) {
    setOutcomes(prev => prev.map(o => o.issue_id === issueId ? { ...o, outcome } : o))
  }

  function setNote(issueId: string, note: string) {
    setOutcomes(prev => prev.map(o => o.issue_id === issueId ? { ...o, note } : o))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const hasBlockedWithoutNote = outcomes.some(o => o.outcome === "blocked" && !o.note.trim())
    if (hasBlockedWithoutNote) {
      toast.warning("Add a note for each blocked ticket")
      return
    }
    if (!overallNote.trim()) {
      toast.error("Add what was shipped today")
      return
    }
    if (hasRisk && !riskNote.trim()) {
      toast.error("Add a one-line reason for the timeline risk")
      return
    }
    if (qgNeedsReview && !qgReviewWhatWhom.trim()) {
      toast.error("For 'Needs review', add what and from whom")
      return
    }
    const pct = completionPct.trim() ? Math.max(0, Math.min(100, parseInt(completionPct, 10) || 0)) : null
    setLoading(true)
    try {
      // Derive overall status from individual outcomes
      const hasBlocked = outcomes.some(o => o.outcome === "blocked")
      const allDone = outcomes.every(o => o.outcome === "done")
      const overallStatus = hasBlocked ? "blocked" : allDone ? "done" : "partial"

      // accomplished = summary line + per-ticket notes for backward compat
      const accomplishedText = overallNote.trim() ||
        outcomes.map(o => {
          const issue = issues.find(i => i.id === o.issue_id)
          const label = OUTCOMES.find(x => x.value === o.outcome)?.label ?? o.outcome
          return `${issue?.issue_number ? "#" + issue.issue_number + " · " : ""}${issue?.title ?? o.issue_id}: ${label}${o.note ? " - " + o.note : ""}`
        }).join("\n")

      const res = await fetch("/api/eod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accomplished: accomplishedText,
          tagged_issues: outcomes,
          status: overallStatus,
          completion_pct: pct,
          confidence: confidence || null,
          risk: hasRisk,
          risk_note: hasRisk ? (riskNote.trim() || null) : null,
          quality_gate: {
            matches_prd: qgMatchesPrd,
            dev_qa: qgDevQa,
            needs_review: qgNeedsReview,
            review_what_whom: qgNeedsReview ? (qgReviewWhatWhom.trim() || null) : null,
          },
          pending: outcomes
            .filter(o => o.outcome === "pushed" || o.outcome === "blocked")
            .map(o => {
              const issue = issues.find(i => i.id === o.issue_id)
              return `${issue?.title ?? o.issue_id}${o.note ? ": " + o.note : ""}`
            })
            .join("\n") || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      toast.success(existing ? "EOD updated!" : "EOD submitted!")
      router.push("/dashboard")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="max-w-2xl space-y-3">
        <div className="h-6 w-40 bg-card border border-border rounded animate-pulse" />
        <div className="h-3 w-64 bg-card border border-border rounded animate-pulse" />
        <div className="mt-4 bg-card border border-border rounded-lg h-48 animate-pulse" />
      </div>
    )
  }

  // Gate: no SOD today
  if (hasSod === false) {
    return (
      <div className="max-w-2xl h-full overflow-y-auto p-5 md:p-6 lg:p-8">
        <div className="mb-5">
          <h1 className="text-[15px] font-semibold">End of day</h1>
        </div>
        <div className="bg-card border border-border rounded-lg p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-[#f5a524]/15 flex items-center justify-center mx-auto">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-[#f5a524]">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11" r="0.75" fill="currentColor" />
            </svg>
          </div>
          <p className="text-[13px] font-medium">No morning check-in today</p>
          <p className="text-[12px] text-muted-foreground">
            You need to log your morning check-in before submitting an EOD.
          </p>
          <Link
            href="/dashboard/checkin"
            className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 bg-primary text-primary-foreground text-[12px] font-medium rounded-[6px] hover:bg-primary/90 transition-colors"
          >
            Start morning check-in →
          </Link>
        </div>
      </div>
    )
  }

  // Gate: no tagged issues in SOD (legacy text-only check-in)
  if (issues.length === 0 && hasSod) {
    return (
      <div className="max-w-2xl h-full overflow-y-auto p-5 md:p-6 lg:p-8">
        <div className="mb-5">
          <h1 className="text-[15px] font-semibold">End of day</h1>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 text-center space-y-2">
          <p className="text-[13px] text-muted-foreground">
            Your morning check-in doesn&apos;t have tagged tickets yet.
          </p>
          <Link href="/dashboard/checkin" className="text-[12px] text-primary hover:underline">
            Update your check-in with tickets →
          </Link>
        </div>
      </div>
    )
  }

  const doneCount = outcomes.filter(o => o.outcome === "done").length
  const blockedCount = outcomes.filter(o => o.outcome === "blocked").length

  return (
    <div className="h-full overflow-y-auto p-5 md:p-6 lg:p-8">
    <div className="max-w-2xl">
      <div className="mb-5">
        <h1 className="text-[15px] font-semibold">End of day</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          How did each ticket go today?
        </p>
      </div>

      {existing && (
        <div className="bg-primary/8 border border-primary/20 rounded-lg px-3 py-2.5 mb-4">
          <p className="text-[12px] text-primary">Updating today&apos;s EOD.</p>
        </div>
      )}
      <div className="flex items-center gap-1.5 mb-4">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted-foreground/50 shrink-0">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M6 5.5v3M6 4v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <p className="text-[11px] text-muted-foreground/50">Best submitted before 8 PM IST</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* ── Per-ticket outcomes ────────────────────────── */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Tickets · {issues.length}
            </p>
            {outcomes.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {doneCount > 0 && <span className="text-[#26d97f]">{doneCount} done</span>}
                {blockedCount > 0 && <span className="text-[#f54260]">{blockedCount} blocked</span>}
              </div>
            )}
          </div>

          <div className="divide-y divide-border/50">
            {issues.map(issue => {
              const outcome = outcomes.find(o => o.issue_id === issue.id)
              const currentOutcome = outcome?.outcome ?? "done"
              const activeStyle = OUTCOMES.find(o => o.value === currentOutcome)

              return (
                <div key={issue.id} className="px-4 py-3 space-y-2.5">
                  {/* Issue info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <IssueTypeIcon type={issue.type} size={13} />
                    {issue.issue_number && (
                      <span className="text-[11px] text-muted-foreground font-mono shrink-0">#{issue.issue_number}</span>
                    )}
                    <span className="text-[12px] font-medium truncate flex-1">{issue.title}</span>
                    {issue.workflow_status && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: issue.workflow_status.color }} />
                        {issue.workflow_status.name}
                      </span>
                    )}
                  </div>

                  {/* Outcome pills */}
                  <div className="flex gap-1.5 flex-wrap">
                    {OUTCOMES.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setOutcome(issue.id, opt.value)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[11px] font-medium border transition-all"
                        style={currentOutcome === opt.value
                          ? { borderColor: opt.color + "50", backgroundColor: opt.bg, color: opt.color }
                          : { borderColor: "var(--border)", backgroundColor: "transparent", color: "var(--muted-foreground)" }
                        }
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Note field for blocked/pushed */}
                  {(currentOutcome === "blocked" || currentOutcome === "pushed") && (
                    <textarea
                      autoFocus={currentOutcome === "blocked"}
                      value={outcome?.note ?? ""}
                      onChange={e => setNote(issue.id, e.target.value)}
                      placeholder={
                        currentOutcome === "blocked"
                          ? "What's blocking this? (required)"
                          : "Any notes for tomorrow?"
                      }
                      rows={2}
                      className="w-full px-3 py-2 text-[12px] bg-secondary border border-border rounded-[5px] resize-y min-h-[56px] focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── What's shipped + delivery signals ─────────── */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-5">
          {/* What's shipped today */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              What&apos;s shipped today? <span className="text-destructive">*</span>
            </label>
            <textarea
              placeholder="Mention outcomes achieved (PR links may be included for reference, if applicable)."
              value={overallNote}
              onChange={e => setOverallNote(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-[13px] bg-secondary border border-border rounded-[6px] resize-y min-h-[110px] focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Overall completion % */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Overall completion (%) toward final delivery?
            </label>
            <input
              type="number" min={0} max={100} step={5}
              placeholder="Includes development, testing, and documentation."
              value={completionPct}
              onChange={e => setCompletionPct(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-secondary border border-border rounded-[6px] focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Confidence */}
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Confidence in next commitment
            </label>
            <div className="flex gap-2 flex-wrap">
              {([
                { v: "high", l: "High", c: "#26d97f" },
                { v: "medium", l: "Medium", c: "#f5a524" },
                { v: "low", l: "Low", c: "#f54260" },
              ] as const).map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setConfidence(c => c === opt.v ? "" : opt.v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12px] border transition-all"
                  style={confidence === opt.v
                    ? { borderColor: opt.c + "50", backgroundColor: opt.c + "15", color: opt.c }
                    : { borderColor: "var(--border)", backgroundColor: "transparent", color: "var(--muted-foreground)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: opt.c }} />
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {/* Risk to timeline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Risk to timeline?
              </label>
              <EodYesNo value={hasRisk} onChange={setHasRisk} />
            </div>
            {hasRisk && (
              <input
                autoFocus
                placeholder="Why? (one line)"
                value={riskNote}
                onChange={e => setRiskNote(e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-secondary border border-border rounded-[6px] focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
              />
            )}
          </div>

          {/* Quality gate */}
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Quality gate
            </label>
            <div className="space-y-1.5">
              <CheckRow label="Work matches Requirements/PRD" checked={qgMatchesPrd} onChange={setQgMatchesPrd} />
              <CheckRow label="Basic Dev/QA checks done" checked={qgDevQa} onChange={setQgDevQa} />
              <CheckRow label="Needs review" checked={qgNeedsReview} onChange={setQgNeedsReview} />
              {qgNeedsReview && (
                <input
                  autoFocus
                  placeholder="What needs review, and from whom?"
                  value={qgReviewWhatWhom}
                  onChange={e => setQgReviewWhatWhom(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-secondary border border-border rounded-[6px] focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            size="sm"
            className="h-8 text-[13px] px-4"
            disabled={loading}
          >
            {loading ? "Submitting..." : existing ? "Update EOD" : "Submit EOD"}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-[13px]"
            onClick={() => router.push("/dashboard")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
    </div>
  )
}

function EodYesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
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

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] border border-border bg-secondary/40 hover:bg-secondary transition-colors text-left"
    >
      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
        checked ? "bg-primary border-primary" : "border-border bg-background"
      }`}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </span>
      <span className="text-[13px]">{label}</span>
    </button>
  )
}
