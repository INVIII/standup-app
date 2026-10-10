"use client"

import { useState } from "react"
import { cn, getInitials } from "@/lib/utils"
import { Dropdown } from "@/components/ui/Dropdown"

type Member = { id: string; name: string; avatar_color: string }

export const UNASSIGNED = "__unassigned__"
const MAX_VISIBLE = 5

/**
 * Jira-style assignee filter: multi-select, capped avatar row + "+N" overflow
 * with a searchable picker. Selected avatars are always surfaced first.
 */
export function AssigneeFilter({
  members, value, onChange,
}: {
  members: Member[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])

  // Stable order — the first N are quick toggles; the rest live in the picker.
  const visible = members.slice(0, MAX_VISIBLE)
  const overflow = members.slice(MAX_VISIBLE)
  const hidden = overflow.length
  const unassignedActive = value.includes(UNASSIGNED)
  // Highlight the "+N" button when a hidden person / Unassigned is active
  const overflowActive = unassignedActive || overflow.some(m => value.includes(m.id))

  return (
    <div className="flex items-center gap-1.5">
      {visible.map(m => {
        const isSel = value.includes(m.id)
        return (
          <button
            key={m.id}
            onClick={() => toggle(m.id)}
            title={m.name}
            className={cn(
              "relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white transition-all",
              isSel
                ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                : "opacity-40 hover:opacity-90"
            )}
            style={{ backgroundColor: m.avatar_color }}
          >
            {getInitials(m.name)}
            {isSel && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                <svg width="7" height="7" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            )}
          </button>
        )
      })}

      <Dropdown
        align="left"
        width={240}
        buttonTitle="Filter by assignee"
        buttonClassName={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold border-2 border-dashed transition-colors shrink-0",
          overflowActive ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
        )}
        button={hidden > 0 ? `+${hidden}` : <SearchIcon />}
      >
        {() => <AssigneePicker members={overflow} value={value} onToggle={toggle} />}
      </Dropdown>
    </div>
  )
}

function AssigneePicker({
  members, value, onToggle,
}: {
  members: Member[]
  value: string[]
  onToggle: (id: string) => void
}) {
  const [q, setQ] = useState("")
  const filtered = members.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <div className="px-2 pb-1.5 pt-0.5">
        <input
          autoFocus value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search people…"
          className="w-full h-7 px-2 text-[12px] bg-secondary border border-border rounded outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <Row label="Unassigned" active={value.includes(UNASSIGNED)} onClick={() => onToggle(UNASSIGNED)} dashed />
      {filtered.map(m => (
        <Row key={m.id} label={m.name} color={m.avatar_color} active={value.includes(m.id)} onClick={() => onToggle(m.id)} />
      ))}
      {filtered.length === 0 && <p className="px-3 py-2 text-[11px] text-muted-foreground">No people found</p>}
    </div>
  )
}

function Row({ label, color, active, onClick, dashed }: {
  label: string; color?: string; active: boolean; onClick: () => void; dashed?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-secondary transition-colors"
    >
      {dashed ? (
        <span className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/50 shrink-0" />
      ) : (
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0" style={{ backgroundColor: color }}>
          {getInitials(label)}
        </span>
      )}
      <span className="text-[12px] flex-1 truncate">{label}</span>
      {active && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-primary shrink-0">
          <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

const SearchIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)
