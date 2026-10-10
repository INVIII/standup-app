"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatTime } from "@/lib/utils"
import type { DailySummary, Insight } from "@/types/database"

const INSIGHT_CONFIG: Record<string, { color: string; label: string }> = {
  blocker: { color: "#f54260", label: "Blocker" },
  risk: { color: "#f5a524", label: "Risk" },
  reminder: { color: "#5e6ad2", label: "Reminder" },
  kudos: { color: "#26d97f", label: "Kudos" },
  suggestion: { color: "#8b8b8b", label: "Suggestion" },
}

function parseParagraphs(text?: string): string[] {
  if (!text) return []
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean)
}

type GenerateState = "idle" | "streaming" | "saving" | "insights" | "done" | "no_data"

export function AISummaryCard({
  summary,
  date,
  isAdmin,
}: {
  summary: DailySummary | null
  date: string
  isAdmin: boolean
}) {
  const [data, setData] = useState<DailySummary | null>(summary)
  const [genState, setGenState] = useState<GenerateState>("idle")
  const [streamText, setStreamText] = useState("")
  const [liveInsights, setLiveInsights] = useState<Insight[]>([])

  const isGenerating = genState !== "idle" && genState !== "done" && genState !== "no_data"

  async function generate() {
    setGenState("streaming")
    setStreamText("")
    setLiveInsights([])

    try {
      const res = await fetch(`/api/summary?date=${date}`, { method: "POST" })

      // If response is JSON (not SSE), handle it directly
      const contentType = res.headers.get("content-type") ?? ""
      if (contentType.includes("application/json")) {
        const json = await res.json().catch(() => ({}))
        if (json.message === "no_data_for_date") {
          setGenState("no_data")
          return
        }
        throw new Error(json.detail || json.error || "Failed to generate")
      }

      if (!res.ok || !res.body) {
        throw new Error("Failed to generate")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        // SSE blocks are separated by \n\n
        const blocks = buf.split("\n\n")
        buf = blocks.pop() ?? ""

        for (const block of blocks) {
          const line = block.trim()
          if (!line.startsWith("data: ")) continue
          let event: { type: string; text?: string; summary?: DailySummary; insights?: Insight[]; message?: string }
          try {
            event = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (event.type === "chunk" && event.text) {
            setStreamText((prev) => prev + event.text)
          } else if (event.type === "saved" && event.summary) {
            setGenState("insights")
            setData(event.summary)
          } else if (event.type === "insights") {
            setLiveInsights(event.insights ?? [])
            setGenState("done")
          } else if (event.type === "done") {
            setGenState("done")
            toast.success("Summary saved")
          } else if (event.type === "error") {
            throw new Error(event.message || "Generation failed")
          }
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error generating summary")
      setGenState("idle")
    }
  }

  // ── STREAMING VIEW ──────────────────────────────────────────────────────
  if (genState === "streaming" || genState === "saving" || genState === "insights") {
    return (
      <div className="space-y-2">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">AI Summary</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {genState === "streaming" ? "Writing…" : genState === "saving" ? "Saving…" : "Loading insights…"}
            </span>
          </div>

          <div className="p-5">
            {streamText ? (
              <div className="space-y-4">
                {parseParagraphs(streamText).map((para, i, arr) => (
                  <p key={i} className="text-[13.5px] text-foreground/85 leading-[1.75]">
                    {para}
                    {/* cursor only on last paragraph while still streaming */}
                    {i === arr.length - 1 && genState === "streaming" && (
                      <span className="inline-block w-0.5 h-[1em] bg-foreground/60 ml-0.5 align-text-bottom animate-pulse" />
                    )}
                  </p>
                ))}
                {/* if text hasn't double-newlined yet, show single block + cursor */}
                {parseParagraphs(streamText).length === 0 && (
                  <p className="text-[13.5px] text-foreground/85 leading-[1.75] whitespace-pre-wrap">
                    {streamText}
                    <span className="inline-block w-0.5 h-[1em] bg-foreground/60 ml-0.5 align-text-bottom animate-pulse" />
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-[90%]" />
                <Skeleton className="h-3.5 w-[80%]" />
              </div>
            )}
          </div>
        </div>

        {genState === "insights" && liveInsights.length > 0 && (
          <InsightsCard insights={liveInsights} />
        )}
        {genState === "insights" && liveInsights.length === 0 && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-pulse shrink-0" />
              <span className="text-[12px] text-muted-foreground">Generating insights…</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── NO DATA STATE ───────────────────────────────────────────────────────
  if (genState === "no_data") {
    return (
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-muted-foreground/50">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.7" fill="currentColor" />
          </svg>
          <span className="text-[12px] text-muted-foreground">No check-ins submitted</span>
        </div>
        <p className="text-[12px] text-muted-foreground/60">
          No one has logged a check-in for this day - nothing to summarize.
        </p>
      </div>
    )
  }

  // ── EMPTY STATE ─────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="bg-card border border-border rounded-lg p-5">
        <p className="text-[13px] text-muted-foreground mb-4">No summary generated yet for this day.</p>
        {isAdmin ? (
          <Button size="sm" className="h-7 text-[12px]" onClick={generate}>
            Generate AI summary
          </Button>
        ) : (
          <p className="text-[12px] text-muted-foreground">Ask your admin to generate the daily summary.</p>
        )}
      </div>
    )
  }

  // ── SETTLED / SAVED STATE ───────────────────────────────────────────────
  const paragraphs = parseParagraphs(data.summary_text)
  const insights: Insight[] = liveInsights.length > 0
    ? liveInsights
    : Array.isArray(data.insights) ? data.insights : []

  return (
    <div className="space-y-2">
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none" className="text-primary shrink-0">
              <path d="M6.5 1L7.8 4.7H11.5L8.4 7.1 9.5 11 6.5 8.8 3.5 11 4.6 7.1 1.5 4.7H5.2L6.5 1Z" fill="currentColor" />
            </svg>
            <span className="text-[11px] font-semibold uppercase tracking-wider">AI Summary</span>
          </div>
          <div className="flex items-center gap-3">
            {data.generated_at && (
              <span className="text-[10px] text-muted-foreground/60">
                {formatTime(data.generated_at)}
              </span>
            )}
            {isAdmin && !isGenerating && (
              <button
                onClick={generate}
                className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                Regenerate
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          <div className="space-y-4">
            {paragraphs.map((para, i) => (
              <p key={i} className="text-[13.5px] text-foreground/85 leading-[1.75]">
                {para}
              </p>
            ))}
          </div>
        </div>
      </div>

      {insights.length > 0 && <InsightsCard insights={insights} />}
    </div>
  )
}

function InsightsCard({ insights }: { insights: Insight[] }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-wider">Insights</span>
      </div>
      <div className="divide-y divide-border">
        {insights.map((insight, i) => {
          const cfg = INSIGHT_CONFIG[insight.type] ?? INSIGHT_CONFIG.suggestion
          return (
            <div key={i} className="px-5 py-3.5 flex items-start gap-3">
              {/* Fixed-width badge column so titles always align */}
              <div className="w-[76px] shrink-0 pt-px">
                <span
                  className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded leading-tight"
                  style={{ color: cfg.color, backgroundColor: cfg.color + "18" }}
                >
                  {cfg.label}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold leading-snug">{insight.title}</p>
                <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{insight.detail}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
