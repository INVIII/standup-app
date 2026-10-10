"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { getInitials } from "@/lib/utils"

type Member = { id: string; name: string; avatar_color: string; role: string }
type Leave = {
  id: string
  profile_id: string
  leave_date: string
  leave_type: "full" | "half"
  reason?: string | null
}
type Holiday = { id: string; name: string; holiday_date: string }

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function todayISO() {
  return toLocalISO(new Date())
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Kolkata",
  })
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/* ── Who's out banner ──────────────────────────────── */
function OutTodayBanner({ leaves, members }: { leaves: Leave[]; members: Member[] }) {
  const today = todayISO()
  const outToday = leaves.filter(l => l.leave_date === today)
  if (outToday.length === 0) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20 text-[12.5px]">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-amber-400 shrink-0">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.75" fill="currentColor" />
      </svg>
      <span className="text-amber-300/90">
        <span className="font-medium">Out today: </span>
        {outToday.map((l, i) => {
          const m = members.find(x => x.id === l.profile_id)
          if (!m) return null
          return (
            <span key={l.id}>
              {i > 0 && ", "}
              <span className="font-medium text-amber-200">{m.name}</span>
              {l.leave_type === "half" && <span className="text-amber-400/70"> (half day)</span>}
            </span>
          )
        })}
      </span>
    </div>
  )
}

/* ── Member leave popover ──────────────────────────── */
function MemberPopover({
  member,
  leaves,
  onClose,
}: {
  member: Member
  leaves: Leave[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const today = todayISO()

  const memberLeaves = leaves
    .filter(l => l.profile_id === member.id && l.leave_date >= today)
    .sort((a, b) => a.leave_date.localeCompare(b.leave_date))
    .slice(0, 8)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute left-full top-0 ml-2 z-50 w-[240px] bg-popover border border-border rounded-lg shadow-xl overflow-hidden"
    >
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-2.5">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
          style={{ backgroundColor: member.avatar_color ?? "#5e6ad2" }}
        >
          {getInitials(member.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium truncate">{member.name}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{member.role}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Upcoming leaves
        </p>
        {memberLeaves.length === 0 ? (
          <p className="text-[12px] text-muted-foreground py-2">No upcoming leaves</p>
        ) : (
          <div className="space-y-1.5">
            {memberLeaves.map(l => (
              <div key={l.id} className="flex items-center justify-between gap-2">
                <span className="text-[12px]">{formatDate(l.leave_date)}</span>
                <div className="flex items-center gap-1.5">
                  {l.reason && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{l.reason}</span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize shrink-0 ${l.leave_type === "full"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-amber-500/8 text-amber-400/70 border border-amber-500/20"
                    }`}>
                    {l.leave_type === "full" ? "Full" : "½ day"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Calendar grid ─────────────────────────────────── */
function CalendarGrid({
  members,
  leaves,
  holidays,
}: {
  members: Member[]
  leaves: Leave[]
  holidays: Holiday[]
}) {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  const { days, thisWeek, nextWeek } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO_ = todayISO()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())

    const allDays = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      const iso = toLocalISO(d)
      return {
        d,
        iso,
        isToday: iso === todayISO_,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        holiday: holidays.find(h => h.holiday_date === iso) ?? null,
      }
    })
    return { days: allDays, thisWeek: allDays.slice(0, 7), nextWeek: allDays.slice(7, 14) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holidays])

  function renderWeek(weekDays: typeof days, weekLabel: string) {
    return (
      <div className="flex-1 min-w-[320px]">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-1">{weekLabel}</p>
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map(({ d, iso, isToday, isWeekend, holiday }) => (
              <div
                key={iso}
                className={`py-2 text-center border-r border-border last:border-r-0 ${isWeekend ? "bg-secondary/30" : ""} ${isToday ? "bg-primary/8" : ""}`}
              >
                <p className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-muted-foreground/50"}`}>
                  {DAY_LABELS[d.getDay()]}
                </p>
                <p className={`text-[13px] font-semibold mt-0.5 ${isToday ? "text-primary" : isWeekend ? "text-muted-foreground/40" : ""}`}>
                  {d.getDate()}
                </p>
                {holiday ? (
                  <p className="text-[8px] text-blue-400 truncate px-0.5 mt-0.5" title={holiday.name}>
                    {holiday.name}
                  </p>
                ) : (
                  <p className="text-[8px] text-muted-foreground/30">{MONTH_LABELS[d.getMonth()]}</p>
                )}
              </div>
            ))}
          </div>

          {/* Member rows */}
          {members.map(member => (
            <div key={member.id} className="grid grid-cols-7 border-b border-border/40 last:border-0 hover:bg-secondary/5 transition-colors">
              {weekDays.map(({ iso, isToday, isWeekend, holiday }) => {
                const leave = leaves.find(l => l.profile_id === member.id && l.leave_date === iso)
                return (
                  <div
                    key={iso}
                    className={`h-9 flex items-center justify-center border-r border-border/20 last:border-r-0 ${isWeekend ? "bg-secondary/15" : ""} ${isToday ? "bg-primary/4" : ""}`}
                  >
                    {holiday && !leave && (
                      <div className="w-4 h-1 rounded-full bg-blue-500/25" title={holiday.name} />
                    )}
                    {leave && (
                      <div
                        className={`rounded px-1.5 py-0.5 text-[9px] font-medium leading-none ${leave.leave_type === "full"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-amber-500/10 text-amber-400/80 border border-amber-500/20"
                          }`}
                        title={leave.reason ?? (leave.leave_type === "full" ? "Full day" : "Half day")}
                      >
                        {leave.leave_type === "full" ? "Out" : "½"}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {members.length === 0 && (
            <div className="h-9 flex items-center justify-center text-[12px] text-muted-foreground">-</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3 overflow-x-auto">
        <div className="shrink-0 w-[148px]">
          <p className="text-[10px] font-medium mb-1.5 px-1 invisible select-none">·</p>
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <div className="border-b border-border h-16 px-3 flex items-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Team</p>
            </div>
            {members.map(member => (
              <div
                key={member.id}
                className="relative h-9 flex items-center gap-2 px-3 border-b border-border/40 last:border-0 hover:bg-secondary/5 transition-colors cursor-pointer"
                onClick={() => setSelectedMember(selectedMember?.id === member.id ? null : member)}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                  style={{ backgroundColor: member.avatar_color ?? "#5e6ad2" }}
                >
                  {getInitials(member.name)}
                </div>
                <span className="text-[12px] truncate flex-1">{member.name}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-muted-foreground/30">
                  <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {selectedMember?.id === member.id && (
                  <MemberPopover
                    member={member}
                    leaves={leaves}
                    onClose={() => setSelectedMember(null)}
                  />
                )}
              </div>
            ))}
            {members.length === 0 && (
              <div className="h-9 flex items-center px-3">
                <span className="text-[12px] text-muted-foreground">No members</span>
              </div>
            )}
          </div>
        </div>

        {renderWeek(thisWeek, "This week")}
        {renderWeek(nextWeek, "Next week")}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 px-1">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-4 h-1.5 rounded-full bg-amber-500/25" />
          Full day out
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-4 h-1.5 rounded-full border border-amber-500/30 bg-amber-500/10" />
          Half day
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-4 h-1 rounded-full bg-blue-500/25" />
          Holiday
        </div>
        <p className="text-[10px] text-muted-foreground/40 ml-auto">Click a name to see their leaves</p>
      </div>
    </div>
  )
}

/* ── Mark leave form ───────────────────────────────── */
function MarkLeaveForm({
  members,
  currentUserId,
  isAdmin,
  teamId,
  onAdded,
}: {
  members: Member[]
  currentUserId: string
  isAdmin: boolean
  teamId: string
  onAdded: (leave: Leave) => void
}) {
  const [profileId, setProfileId] = useState(currentUserId)
  const [date, setDate] = useState(todayISO())
  const [type, setType] = useState<"full" | "half">("full")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!profileId || !date) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("leaves")
      .upsert(
        { profile_id: profileId, team_id: teamId, leave_date: date, leave_type: type, reason: reason || null, marked_by: currentUserId },
        { onConflict: "profile_id,leave_date" }
      )
      .select()
      .single()
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success("Leave marked")
    onAdded(data as Leave)
    setReason("")
    setSaving(false)
  }

  const selfMember = members.find(m => m.id === currentUserId)

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-card p-4 space-y-3">
      <p className="text-[13px] font-medium">Mark leave</p>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Member</label>
          {isAdmin ? (
            <select
              value={profileId}
              onChange={e => setProfileId(e.target.value)}
              className="w-full h-8 px-2 text-[13px] bg-secondary border border-border rounded-[5px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          ) : (
            <div className="h-8 px-3 flex items-center text-[13px] bg-secondary/40 border border-border rounded-[5px] text-muted-foreground">
              {selfMember?.name ?? "You"}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            className="w-full h-8 px-3 text-[13px] bg-secondary border border-border rounded-[5px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 dark:[color-scheme:dark]"
          />
        </div>
      </div>

      <div className="flex gap-2">
        {(["full", "half"] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-3 py-1.5 text-[12px] rounded-[5px] border transition-all capitalize ${type === t ? "border-transparent bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground"
              }`}
          >
            {t} day
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
          Reason <span className="normal-case tracking-normal font-normal text-muted-foreground/50">(optional)</span>
        </label>
        <input
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Medical, personal, travel…"
          className="w-full h-8 px-3 text-[13px] bg-secondary border border-border rounded-[5px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="h-8 px-4 text-[12px] font-medium bg-primary text-primary-foreground rounded-[5px] hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving…" : "Mark leave"}
      </button>
    </form>
  )
}

/* ── Upcoming leaves list ──────────────────────────── */
function UpcomingLeaves({
  leaves, members, isAdmin, onRemoved,
}: {
  leaves: Leave[]
  members: Member[]
  isAdmin: boolean
  onRemoved: (id: string) => void
}) {
  const upcoming = leaves
    .filter(l => l.leave_date >= todayISO())
    .sort((a, b) => a.leave_date.localeCompare(b.leave_date))
    .slice(0, 20)

  async function remove(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("leaves").delete().eq("id", id)
    if (error) { toast.error(error.message); return }
    onRemoved(id)
    toast.success("Leave removed")
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-[13px] font-medium">Upcoming leaves</p>
        <span className="text-[11px] text-muted-foreground">{upcoming.length} entries</span>
      </div>
      {upcoming.length === 0 ? (
        <p className="px-4 py-5 text-[12px] text-muted-foreground text-center">No upcoming leaves</p>
      ) : (
        <div className="divide-y divide-border/40">
          {upcoming.map(l => {
            const member = members.find(m => m.id === l.profile_id)
            return (
              <div key={l.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/20 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                    style={{ backgroundColor: member?.avatar_color ?? "#6b6b6b" }}
                  >
                    {getInitials(member?.name ?? "?")}
                  </div>
                  <span className="text-[13px] font-medium">{member?.name ?? "-"}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded capitalize shrink-0 ${l.leave_type === "full"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-amber-500/8 text-amber-400/70 border border-amber-500/20"
                    }`}>
                    {l.leave_type === "full" ? "Full day" : "Half day"}
                  </span>
                  {l.reason && (
                    <span className="text-[11px] text-muted-foreground hidden sm:block">{l.reason}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[12px] text-muted-foreground">{formatDate(l.leave_date)}</span>
                  {isAdmin && (
                    <button onClick={() => remove(l.id)}
                      className="text-[10px] text-muted-foreground/50 hover:text-red-400 transition-colors">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Holidays list ─────────────────────────────────── */
function HolidaysList({
  holidays, isAdmin, teamId, onRemoved, onAdded,
}: {
  holidays: Holiday[]
  isAdmin: boolean
  teamId: string
  onRemoved: (id: string) => void
  onAdded: (h: Holiday) => void
}) {
  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !date) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("holidays")
      .insert({ team_id: teamId, name: name.trim(), holiday_date: date })
      .select().single()
    if (error) {
      toast.error(error.code === "23505" ? "A holiday already exists on that date" : error.message)
      setSaving(false); return
    }
    toast.success(`${name} added`)
    onAdded(data as Holiday)
    setName(""); setDate("")
    setSaving(false)
  }

  async function remove(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("holidays").delete().eq("id", id)
    if (error) { toast.error(error.message); return }
    onRemoved(id)
    toast.success("Removed")
  }

  const upcoming = holidays
    .filter(h => h.holiday_date >= todayISO())
    .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-[13px] font-medium">Holidays</p>
        <span className="text-[11px] text-muted-foreground">{upcoming.length} upcoming</span>
      </div>

      {isAdmin && (
        <form onSubmit={submit} className="px-4 py-3 border-b border-border flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Diwali, Christmas…"
              required
              className="w-full h-7 px-2.5 text-[12px] bg-secondary border border-border rounded-[5px] focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="h-7 px-2.5 text-[12px] bg-secondary border border-border rounded-[5px] focus:outline-none focus:ring-1 focus:ring-primary/40 dark:[color-scheme:dark]"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !name.trim() || !date}
            className="h-7 px-3 text-[12px] bg-primary text-primary-foreground rounded-[5px] hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            Add
          </button>
        </form>
      )}

      {upcoming.length === 0 ? (
        <p className="px-4 py-5 text-[12px] text-muted-foreground text-center">No upcoming holidays</p>
      ) : (
        <div className="divide-y divide-border/40">
          {upcoming.map(h => (
            <div key={h.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/20 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <span className="text-[13px] font-medium">{h.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-muted-foreground">{formatDate(h.holiday_date)}</span>
                {isAdmin && (
                  <button onClick={() => remove(h.id)}
                    className="text-[10px] text-muted-foreground/50 hover:text-red-400 transition-colors">
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main ──────────────────────────────────────────── */
export function AvailabilityView({
  initialMembers,
  initialLeaves,
  initialHolidays,
  initialCurrentUserId,
  initialTeamId,
  initialIsAdmin,
}: {
  initialMembers?: Member[]
  initialLeaves?: Leave[]
  initialHolidays?: Holiday[]
  initialCurrentUserId?: string
  initialTeamId?: string
  initialIsAdmin?: boolean
}) {
  const hasInitialData = !!(initialMembers && initialCurrentUserId && initialTeamId)

  const [members, setMembers] = useState<Member[]>(initialMembers ?? [])
  const [leaves, setLeaves] = useState<Leave[]>(initialLeaves ?? [])
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays ?? [])
  const [teamId, setTeamId] = useState<string | null>(initialTeamId ?? null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialCurrentUserId ?? null)
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin ?? false)
  const [loading, setLoading] = useState(!hasInitialData)

  useEffect(() => {
    // Skip client-side fetch when the server already provided data
    if (hasInitialData) return

    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id, role")
        .eq("id", user.id)
        .single()
      if (!profile?.team_id) return

      const tid = profile.team_id
      setTeamId(tid)
      setIsAdmin(profile.role === "admin")

      const thirtyAgo = toLocalISO(new Date(Date.now() - 30 * 86400000))
      const sixtyAhead = toLocalISO(new Date(Date.now() + 60 * 86400000))

      const [{ data: mems }, { data: lvs }, { data: hols }] = await Promise.all([
        supabase.from("profiles")
          .select("id, name, avatar_color, role")
          .eq("team_id", tid)
          .eq("is_active", true)
          .order("name"),
        supabase.from("leaves")
          .select("id, profile_id, leave_date, leave_type, reason")
          .eq("team_id", tid)
          .gte("leave_date", thirtyAgo)
          .lte("leave_date", sixtyAhead)
          .order("leave_date"),
        supabase.from("holidays")
          .select("id, name, holiday_date")
          .eq("team_id", tid)
          .gte("holiday_date", thirtyAgo)
          .order("holiday_date"),
      ])

      setMembers((mems ?? []) as Member[])
      setLeaves((lvs ?? []) as Leave[])
      setHolidays((hols ?? []) as Holiday[])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <div className="h-10 rounded-lg bg-card border border-border animate-pulse" />
        <div className="h-64 rounded-lg bg-card border border-border animate-pulse" />
      </div>
    )
  }

  if (!teamId || !currentUserId) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh] text-center">
        <p className="text-[14px] font-medium mb-1">Not connected to a team</p>
        <p className="text-[12px] text-muted-foreground">Join or create a team to see availability.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <OutTodayBanner leaves={leaves} members={members} />

      <div>
        <p className="text-[13px] font-semibold mb-3">Team calendar</p>
        <CalendarGrid members={members} leaves={leaves} holidays={holidays} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MarkLeaveForm
          members={members}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          teamId={teamId}
          onAdded={leave => setLeaves(prev => {
            const idx = prev.findIndex(l => l.profile_id === leave.profile_id && l.leave_date === leave.leave_date)
            if (idx >= 0) { const next = [...prev]; next[idx] = leave; return next }
            return [...prev, leave]
          })}
        />
        <div className="lg:col-span-2 space-y-4">
          <UpcomingLeaves
            leaves={leaves}
            members={members}
            isAdmin={isAdmin}
            onRemoved={id => setLeaves(prev => prev.filter(l => l.id !== id))}
          />
          <HolidaysList
            holidays={holidays}
            isAdmin={isAdmin}
            teamId={teamId}
            onRemoved={id => setHolidays(prev => prev.filter(h => h.id !== id))}
            onAdded={h => setHolidays(prev => [...prev, h].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)))}
          />
        </div>
      </div>
    </div>
  )
}
