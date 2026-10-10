"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { Issue, WorkflowStatus } from "@/types/database"
import { IssueDetailPanel } from "./IssueDetailPanel"
import { IssueTypeIcon } from "./IssueTypeBadge"

type Member = { id: string; name: string; avatar_color: string }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}

export function CalendarView({
  boardId,
  issues,
  statuses,
  members,
}: {
  boardId: string
  issues: Issue[]
  statuses: WorkflowStatus[]
  members: Member[]
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)

  const firstDay = new Date(year, month, 1)
  const totalDays = daysInMonth(year, month)
  const startDow = firstDay.getDay()

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const issuesByDate: Record<string, Issue[]> = {}
  for (const issue of issues) {
    if (!issue.due_date) continue
    const key = issue.due_date.slice(0, 10)
    if (!issuesByDate[key]) issuesByDate[key] = []
    issuesByDate[key].push(issue)
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const todayStr = toDateStr(today)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">{MONTHS[month]} {year}</h2>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}
            className="px-2.5 h-7 text-[12px] rounded text-muted-foreground hover:bg-accent transition-colors border border-border">
            Today
          </button>
          <button onClick={nextMonth} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-medium text-muted-foreground border-b border-border">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-t border-l border-border">
        {cells.map((day, i) => {
          // Off-month spacer cell
          if (!day) {
            return (
              <div
                key={`empty-${i}`}
                className="min-h-[110px] border-b border-r border-border bg-muted/20"
              />
            )
          }

          const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`
          const dayIssues = issuesByDate[dateStr] ?? []
          const isToday = dateStr === todayStr
          const isPast = dateStr < todayStr
          const isSun = new Date(dateStr).getDay() === 0
          const isSat = new Date(dateStr).getDay() === 6

          return (
            <div
              key={dateStr}
              className={cn(
                "min-h-[110px] border-b border-r border-border p-1.5 flex flex-col gap-1",
                (isSat || isSun) && "bg-muted/10",
                isPast && !isSat && !isSun && "bg-background",
                isToday && "bg-primary/5"
              )}
            >
              <span className={cn(
                "text-[11px] font-medium w-6 h-6 flex items-center justify-center rounded-full self-end shrink-0",
                isToday
                  ? "bg-primary text-primary-foreground"
                  : isPast
                    ? "text-muted-foreground/50"
                    : "text-muted-foreground"
              )}>
                {day}
              </span>
              {dayIssues.slice(0, 3).map(issue => (
                <button
                  key={issue.id}
                  onClick={() => setSelectedIssue(issue)}
                  className="w-full text-left px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1 hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: "rgba(94,106,210,0.12)",
                    border: "1px solid rgba(94,106,210,0.2)",
                  }}
                >
                  <IssueTypeIcon type={issue.type} size={9} />
                  <span className="truncate text-foreground/70 leading-4">{issue.title}</span>
                </button>
              ))}
              {dayIssues.length > 3 && (
                <span className="text-[10px] text-muted-foreground px-0.5">+{dayIssues.length - 3} more</span>
              )}
            </div>
          )
        })}
      </div>

      {selectedIssue && (
        <IssueDetailPanel
          key={selectedIssue.id}
          issue={selectedIssue}
          statuses={statuses}
          members={members}
          onClose={() => setSelectedIssue(null)}
          onUpdate={updated => setSelectedIssue(updated)}
        />
      )}
    </div>
  )
}
