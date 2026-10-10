"use client"

import { useState, useRef, useMemo } from "react"
import { cn } from "@/lib/utils"
import type { Sprint, Issue } from "@/types/database"

type ZoomLevel = "weeks" | "months" | "quarters"
type ReleaseRow = { id: string; name: string; version?: string | null; status: string; release_date?: string | null }

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const STATUS_COLORS: Record<string, string> = {
  unreleased: "#5e6ad2",
  released: "#26d97f",
  archived: "#6b6b6b",
}

/* ── date helpers ─────────────────────────────────── */

function dayMs(d: Date) { return d.getTime() }
function parseDate(s: string | null | undefined): Date | null {
  return s ? new Date(s) : null
}
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * 86400000) }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1) }
function startOfWeek(d: Date) {
  const day = d.getDay()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}

/* ── position helper ─────────────────────────────── */

function usePct(rangeStart: Date, rangeEnd: Date) {
  const totalMs = dayMs(rangeEnd) - dayMs(rangeStart)
  return (date: Date) =>
    Math.max(0, Math.min(100, ((dayMs(date) - dayMs(rangeStart)) / totalMs) * 100))
}

/* ── main component ───────────────────────────────── */

export function TimelineView({
  boardId,
  sprints,
  epics,
  releases,
}: {
  boardId: string
  sprints: Sprint[]
  epics: Issue[]
  releases: ReleaseRow[]
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [zoom, setZoom] = useState<ZoomLevel>("months")
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  const toggleSection = (key: string) =>
    setCollapsedSections(s => ({ ...s, [key]: !s[key] }))

  /* ── compute date range ── */
  const allDates = [
    ...sprints.flatMap(s => [parseDate(s.start_date), parseDate(s.end_date)]),
    ...epics.flatMap(e => [parseDate(e.start_date), parseDate(e.due_date)]),
    ...releases.map(r => parseDate(r.release_date)),
    today,
  ].filter(Boolean) as Date[]

  const minDate = allDates.length
    ? new Date(Math.min(...allDates.map(d => d.getTime())))
    : new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const maxDate = allDates.length
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : new Date(today.getFullYear(), today.getMonth() + 3, 1)

  const rangeStart = addMonths(minDate, -1)
  const rangeEnd = addMonths(maxDate, 2)

  const pct = usePct(rangeStart, rangeEnd)
  const todayPct = pct(today)

  /* ── build column headers based on zoom ── */
  const columns = useMemo(() => {
    const cols: { label: string; left: number; width: number }[] = []

    if (zoom === "months") {
      let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
      while (cur < rangeEnd) {
        const next = addMonths(cur, 1)
        const left = pct(cur < rangeStart ? rangeStart : cur)
        const end = pct(next > rangeEnd ? rangeEnd : next)
        cols.push({ label: `${MONTH_LABELS[cur.getMonth()]} ${cur.getFullYear()}`, left, width: end - left })
        cur = next
      }
    } else if (zoom === "weeks") {
      let cur = startOfWeek(rangeStart)
      while (cur < rangeEnd) {
        const next = addDays(cur, 7)
        const left = pct(cur < rangeStart ? rangeStart : cur)
        const end = pct(next > rangeEnd ? rangeEnd : next)
        const d = cur < rangeStart ? rangeStart : cur
        cols.push({ label: `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`, left, width: end - left })
        cur = next
      }
    } else {
      // quarters
      let cur = new Date(rangeStart.getFullYear(), Math.floor(rangeStart.getMonth() / 3) * 3, 1)
      while (cur < rangeEnd) {
        const next = addMonths(cur, 3)
        const left = pct(cur < rangeStart ? rangeStart : cur)
        const end = pct(next > rangeEnd ? rangeEnd : next)
        const q = Math.floor(cur.getMonth() / 3) + 1
        cols.push({ label: `Q${q} ${cur.getFullYear()}`, left, width: end - left })
        cur = next
      }
    }
    return cols
  }, [zoom, rangeStart, rangeEnd])

  /* ── bar helper ── */
  function Bar({
    start, end, color, label, variant = "filled",
  }: {
    start: Date | null
    end: Date | null
    color: string
    label: string
    variant?: "filled" | "outline"
  }) {
    if (!start && !end) return null
    const s = start ?? today
    const e = end ?? addDays(today, 7)
    const l = pct(s)
    const w = Math.max(1.5, pct(e) - l)
    return (
      <div
        className="absolute top-1/2 -translate-y-1/2 h-5 rounded flex items-center px-2 overflow-hidden"
        style={{
          left: `${l}%`,
          width: `${w}%`,
          backgroundColor: variant === "filled" ? color + "25" : "transparent",
          border: `1.5px solid ${color}60`,
        }}
        title={label}
      >
        <span className="text-[10px] font-medium truncate" style={{ color }}>
          {label}
        </span>
      </div>
    )
  }

  /* ── section row ── */
  function SectionRow({ label, sectionKey, count }: { label: string; sectionKey: string; count: number }) {
    const isCollapsed = collapsedSections[sectionKey]
    return (
      <div className="flex h-8 border-b border-border/40 bg-secondary/20">
        <div className="w-[240px] shrink-0 flex items-center gap-2 px-3 sticky left-0 bg-secondary/20 z-10 border-r border-border/40">
          <button
            onClick={() => toggleSection(sectionKey)}
            className="text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={cn("transition-transform", isCollapsed && "-rotate-90")}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
          <span className="text-[10px] text-muted-foreground/50 ml-auto">{count}</span>
        </div>
        {/* Grid lines */}
        <div className="flex-1 relative">
          {columns.map((col, i) => (
            <div key={i} className="absolute top-0 bottom-0 border-r border-border/20"
              style={{ left: `${col.left + col.width}%` }} />
          ))}
          <div className="absolute top-0 bottom-0 border-l-2 border-primary/30"
            style={{ left: `${todayPct}%` }} />
        </div>
      </div>
    )
  }

  /* ── data row ── */
  function DataRow({
    label, subLabel, startDate, endDate, barColor, barLabel,
    statusBadge, badgeColor,
  }: {
    label: string
    subLabel?: string
    startDate: Date | null
    endDate: Date | null
    barColor: string
    barLabel: string
    statusBadge?: string
    badgeColor?: string
  }) {
    return (
      <div className="flex h-10 border-b border-border/30 hover:bg-secondary/10 transition-colors group">
        {/* Left label */}
        <div className="w-[240px] shrink-0 flex items-center gap-2 px-3 pl-8 sticky left-0 bg-background group-hover:bg-secondary/10 transition-colors z-10 border-r border-border/40 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] truncate">{label}</p>
            {subLabel && <p className="text-[10px] text-muted-foreground/50 truncate">{subLabel}</p>}
          </div>
          {statusBadge && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0"
              style={{ color: badgeColor, backgroundColor: (badgeColor ?? "#888") + "20" }}>
              {statusBadge}
            </span>
          )}
        </div>
        {/* Bar area */}
        <div className="flex-1 relative">
          {/* Grid lines */}
          {columns.map((col, i) => (
            <div key={i} className="absolute top-0 bottom-0 border-r border-border/20"
              style={{ left: `${col.left + col.width}%` }} />
          ))}
          {/* Today line */}
          <div className="absolute top-0 bottom-0 border-l border-primary/25 pointer-events-none"
            style={{ left: `${todayPct}%` }} />
          {/* Bar */}
          <Bar start={startDate} end={endDate} color={barColor} label={barLabel} />
        </div>
      </div>
    )
  }

  const noData = sprints.length === 0 && epics.length === 0 && releases.length === 0

  if (noData) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <p className="text-[14px] font-medium mb-1">No timeline data</p>
        <p className="text-[12px] text-muted-foreground">
          Add dates to sprints and epics to see them here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-0 -mx-1">
      {/* ── Top controls ── */}
      <div className="flex items-center justify-between px-1 pb-3 shrink-0">
        <h2 className="text-[14px] font-semibold">Timeline</h2>
        <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
          {(["weeks","months","quarters"] as ZoomLevel[]).map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={cn(
                "px-3 py-1 text-[11px] rounded transition-colors capitalize",
                zoom === z
                  ? "bg-background text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {z}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => {
              const el = scrollRef.current
              if (!el) return
              el.scrollLeft = (el.scrollWidth * todayPct / 100) - el.clientWidth / 2
            }}
            className="px-3 py-1 text-[11px] rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* ── Main scrollable area ── */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-auto flex-1 border border-border rounded-lg"
        style={{ minHeight: 200 }}
      >
        <div style={{ minWidth: zoom === "weeks" ? 1800 : zoom === "quarters" ? 900 : 1200 }}>

          {/* ── Header: month/week/quarter columns ── */}
          <div className="flex h-9 border-b border-border sticky top-0 bg-background z-20">
            {/* Corner */}
            <div className="w-[240px] shrink-0 flex items-center px-3 border-r border-border sticky left-0 bg-background z-30">
              <span className="text-[11px] text-muted-foreground font-medium">Work</span>
            </div>
            {/* Time headers */}
            <div className="flex-1 relative">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full flex items-center border-r border-border/40"
                  style={{ left: `${col.left}%`, width: `${col.width}%` }}
                >
                  <span className="text-[11px] text-muted-foreground px-2 truncate">{col.label}</span>
                </div>
              ))}
              {/* Today marker in header */}
              <div className="absolute top-0 bottom-0 border-l-2 border-primary z-10"
                style={{ left: `${todayPct}%` }}>
                <span className="absolute top-0.5 left-1 text-[9px] font-semibold text-primary whitespace-nowrap">
                  Today
                </span>
              </div>
            </div>
          </div>

          {/* ── Sprints section ── */}
          {sprints.length > 0 && (
            <>
              <SectionRow label="Sprints" sectionKey="sprints" count={sprints.length} />
              {!collapsedSections["sprints"] && sprints.map(sprint => {
                const color = sprint.status === "active" ? "#26d97f"
                  : sprint.status === "completed" ? "#6b6b6b" : "#5e6ad2"
                return (
                  <DataRow
                    key={sprint.id}
                    label={sprint.name}
                    subLabel={
                      sprint.start_date && sprint.end_date
                        ? `${new Date(sprint.start_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" })} – ${new Date(sprint.end_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" })}`
                        : undefined
                    }
                    startDate={parseDate(sprint.start_date)}
                    endDate={parseDate(sprint.end_date)}
                    barColor={color}
                    barLabel={sprint.name}
                    statusBadge={sprint.status}
                    badgeColor={color}
                  />
                )
              })}
            </>
          )}

          {/* ── Releases section ── */}
          {releases.length > 0 && (
            <>
              <SectionRow label="Releases" sectionKey="releases" count={releases.length} />
              {!collapsedSections["releases"] && releases.map(release => {
                const color = STATUS_COLORS[release.status] ?? "#6b6b6b"
                const date = parseDate(release.release_date)
                return (
                  <DataRow
                    key={release.id}
                    label={release.name}
                    subLabel={release.version ? `v${release.version}` : undefined}
                    startDate={date ? addDays(date, -1) : null}
                    endDate={date}
                    barColor={color}
                    barLabel={release.name}
                    statusBadge={release.status}
                    badgeColor={color}
                  />
                )
              })}
            </>
          )}

          {/* ── Epics section ── */}
          {epics.length > 0 && (
            <>
              <SectionRow label="Epics" sectionKey="epics" count={epics.length} />
              {!collapsedSections["epics"] && epics.map(epic => {
                const ws = (epic as any).workflow_status
                const color = ws?.color ?? "#8b5cf6"
                const board = (epic as any).board
                return (
                  <DataRow
                    key={epic.id}
                    label={epic.title}
                    subLabel={`${board?.key ?? ""}-${epic.issue_number}`}
                    startDate={parseDate(epic.start_date)}
                    endDate={parseDate(epic.due_date)}
                    barColor={color}
                    barLabel={epic.title}
                    statusBadge={ws?.name}
                    badgeColor={ws?.color}
                  />
                )
              })}
            </>
          )}

          {/* Bottom padding */}
          <div className="h-6" />
        </div>
      </div>
    </div>
  )
}
