"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { IssueTypeIcon } from "@/components/board/IssueTypeBadge"

type SearchIssue = {
  id: string
  issue_number: number
  title: string
  type: string
  priority: string
  board_id: string
  board: { key: string; id: string } | null
  workflow_status: { name: string; color: string } | null
}

type SearchMember = {
  id: string
  name: string
  avatar_color: string
  email?: string
}

type SearchResults = {
  issues: SearchIssue[]
  members: SearchMember[]
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
}

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults>({ issues: [], members: [] })
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("")
      setResults({ issues: [], members: [] })
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults({ issues: [], members: [] }); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) setResults(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  function onInput(val: string) {
    setQuery(val)
    setActiveIdx(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 280)
  }

  const allResults: { type: "issue" | "member"; item: SearchIssue | SearchMember }[] = [
    ...results.issues.map(i => ({ type: "issue" as const, item: i })),
    ...results.members.map(m => ({ type: "member" as const, item: m })),
  ]

  function navigate(idx: number) {
    const row = allResults[idx]
    if (!row) return
    onClose()
    if (row.type === "issue") {
      const issue = row.item as SearchIssue
      router.push(`/dashboard/board/${issue.board_id}/backlog?issue=${issue.id}`)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allResults.length - 1)) }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === "Enter") navigate(activeIdx)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-50 w-full max-w-[520px] px-4">
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Input */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="text-muted-foreground shrink-0">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => onInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search issues, members…"
              className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/40"
            />
            {loading && (
              <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
            )}
            <kbd className="text-[10px] text-muted-foreground/40 border border-border rounded px-1 py-0.5 shrink-0">Esc</kbd>
          </div>

          {/* Results */}
          {allResults.length > 0 ? (
            <div className="max-h-[380px] overflow-y-auto py-1.5">
              {/* Issues section */}
              {results.issues.length > 0 && (
                <div>
                  <p className="px-4 py-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                    Issues
                  </p>
                  {results.issues.map((issue, i) => {
                    const idx = i
                    return (
                      <button
                        key={issue.id}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={() => navigate(idx)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors",
                          activeIdx === idx ? "bg-primary/8" : "hover:bg-secondary/50"
                        )}
                      >
                        <IssueTypeIcon type={issue.type as any} size={13} />
                        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                          {issue.board?.key ?? "?"}-{issue.issue_number}
                        </span>
                        <span className="text-[13px] flex-1 truncate">{issue.title}</span>
                        {issue.workflow_status && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                            style={{ color: issue.workflow_status.color, backgroundColor: issue.workflow_status.color + "18" }}
                          >
                            {issue.workflow_status.name}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Members section */}
              {results.members.length > 0 && (
                <div>
                  {results.issues.length > 0 && <div className="border-t border-border/40 my-1" />}
                  <p className="px-4 py-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                    Members
                  </p>
                  {results.members.map((member, i) => {
                    const idx = results.issues.length + i
                    return (
                      <div
                        key={member.id}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2 transition-colors",
                          activeIdx === idx ? "bg-primary/8" : "hover:bg-secondary/50"
                        )}
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                          style={{ backgroundColor: member.avatar_color ?? "#5e6ad2" }}
                        >
                          {getInitials(member.name)}
                        </div>
                        <span className="text-[13px]">{member.name}</span>
                        {member.email && (
                          <span className="text-[11px] text-muted-foreground ml-1">{member.email}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : query && !loading ? (
            <div className="py-10 text-center">
              <p className="text-[12px] text-muted-foreground">No results for &quot;{query}&quot;</p>
            </div>
          ) : !query ? (
            <div className="py-6 px-4 text-center">
              <p className="text-[12px] text-muted-foreground/50">Type to search across issues and members</p>
              <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-muted-foreground/30">
                <span>↑↓ navigate</span>
                <span>↵ open</span>
                <span>Esc close</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
