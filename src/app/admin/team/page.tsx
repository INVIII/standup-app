"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getInitials } from "@/lib/utils"
import type { Profile, Leave, Holiday } from "@/types/database"

import { todayIST as todayISO } from "@/lib/date"

export default function TeamPage() {
  const [members, setMembers] = useState<Profile[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Leave form
  const [leaveProfileId, setLeaveProfileId] = useState("")
  const [leaveDate, setLeaveDate] = useState(todayISO())
  const [leaveType, setLeaveType] = useState<"full" | "half">("full")
  const [leaveReason, setLeaveReason] = useState("")
  const [addingLeave, setAddingLeave] = useState(false)

  // Holiday form
  const [holidayName, setHolidayName] = useState("")
  const [holidayDate, setHolidayDate] = useState("")
  const [addingHoliday, setAddingHoliday] = useState(false)

  // Active tab: 'leaves' | 'holidays'
  const [tab, setTab] = useState<"leaves" | "holidays">("leaves")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", user.id).single()
      if (!profile?.team_id) return
      const tid = profile.team_id
      setTeamId(tid)

      const [{ data: mems }, { data: lvs }, { data: hols }] = await Promise.all([
        supabase.from("profiles").select("*").eq("team_id", tid).eq("is_active", true).order("name"),
        supabase.from("leaves").select("*, profiles(id,name,avatar_color)").eq("team_id", tid).order("leave_date", { ascending: false }).limit(60),
        supabase.from("holidays").select("*").eq("team_id", tid).order("holiday_date", { ascending: true }),
      ])

      setMembers(mems ?? [])
      setLeaves((lvs ?? []) as Leave[])
      setHolidays(hols ?? [])
      if (mems && mems.length > 0) setLeaveProfileId(mems[0].id)
      setLoading(false)
    }
    load()
  }, [])

  async function addLeave(e: React.FormEvent) {
    e.preventDefault()
    if (!leaveProfileId || !leaveDate || !teamId) return
    setAddingLeave(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("leaves")
      .upsert(
        { profile_id: leaveProfileId, team_id: teamId, leave_date: leaveDate, leave_type: leaveType, reason: leaveReason || null, marked_by: currentUserId },
        { onConflict: "profile_id,leave_date" }
      )
      .select("*, profiles(id,name,avatar_color)")
      .single()

    if (error) { toast.error(error.message); setAddingLeave(false); return }
    setLeaves((prev) => {
      const idx = prev.findIndex((l) => l.profile_id === leaveProfileId && l.leave_date === leaveDate)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = data as Leave
        return next
      }
      return [data as Leave, ...prev]
    })
    toast.success("Leave marked")
    setLeaveReason("")
    setAddingLeave(false)
  }

  async function removeLeave(leave: Leave) {
    const supabase = createClient()
    const { error } = await supabase.from("leaves").delete().eq("id", leave.id)
    if (error) { toast.error(error.message); return }
    setLeaves((prev) => prev.filter((l) => l.id !== leave.id))
    toast.success("Leave removed")
  }

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault()
    if (!holidayName.trim() || !holidayDate || !teamId) return
    setAddingHoliday(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("holidays")
      .insert({ team_id: teamId, name: holidayName.trim(), holiday_date: holidayDate })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") toast.error("A holiday already exists on that date")
      else toast.error(error.message)
      setAddingHoliday(false)
      return
    }
    setHolidays((prev) => [...prev, data].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)))
    toast.success(`${holidayName} added`)
    setHolidayName("")
    setHolidayDate("")
    setAddingHoliday(false)
  }

  async function removeHoliday(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("holidays").delete().eq("id", id)
    if (error) { toast.error(error.message); return }
    setHolidays((prev) => prev.filter((h) => h.id !== id))
    toast.success("Holiday removed")
  }

  function formatDate(d: string) {
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Kolkata" })
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-3">
        <div className="h-6 w-32 bg-card border border-border rounded animate-pulse" />
        <div className="h-40 bg-card border border-border rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[15px] font-semibold">Team</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Manage leaves and holidays</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-0.5 rounded-[6px] w-fit">
        {(["leaves", "holidays"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-[12px] font-medium rounded-[5px] transition-all capitalize ${tab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "leaves" && (
        <>
          {/* Mark leave form */}
          <form onSubmit={addLeave} className="bg-card border border-border rounded-lg p-4 space-y-3">
            <p className="text-[13px] font-medium">Mark leave</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Member</label>
                <select
                  value={leaveProfileId}
                  onChange={(e) => setLeaveProfileId(e.target.value)}
                  className="w-full h-8 px-2 text-[13px] bg-secondary border border-border rounded-[5px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Date</label>
                <Input
                  type="date"
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  required
                  className="bg-secondary border-border text-[13px] h-8 dark:[color-scheme:dark]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {(["full", "half"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLeaveType(t)}
                  className={`px-3 py-1.5 text-[12px] rounded-[5px] border transition-all capitalize ${leaveType === t
                      ? "border-transparent bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {t} day
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Reason <span className="normal-case tracking-normal font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <Input
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="Medical, personal, etc."
                className="bg-secondary border-border text-[13px] h-8"
              />
            </div>
            <Button type="submit" size="sm" className="h-7 text-[12px]" disabled={addingLeave || !leaveProfileId}>
              {addingLeave ? "Saving..." : "Mark leave"}
            </Button>
          </form>

          {/* Leave list */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Recent leaves · {leaves.length} entries
              </p>
            </div>
            {leaves.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">No leaves marked yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Member</th>
                    <th className="px-4 py-2 text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2 text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2 text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:table-cell">Reason</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => {
                    const member = members.find((m) => m.id === l.profile_id) ??
                      (l.profiles as Profile | undefined)
                    return (
                      <tr key={l.id} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {member && (
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                                style={{ backgroundColor: member.avatar_color ?? "#5e6ad2" }}
                              >
                                {getInitials(member.name)}
                              </div>
                            )}
                            <span className="text-[13px]">{member?.name ?? "-"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-[13px]">{formatDate(l.leave_date)}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-[11px] capitalize text-muted-foreground px-2 py-0.5 bg-secondary rounded-full border border-border">
                            {l.leave_type} day
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-muted-foreground hidden sm:table-cell">
                          {l.reason ?? "-"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => removeLeave(l)}
                            className="text-[10px] text-muted-foreground hover:text-[#f54260] transition-colors"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "holidays" && (
        <>
          {/* Add holiday form */}
          <form onSubmit={addHoliday} className="bg-card border border-border rounded-lg p-4 space-y-3">
            <p className="text-[13px] font-medium">Add holiday</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Name</label>
                <Input
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="Diwali, Christmas..."
                  required
                  className="bg-secondary border-border text-[13px] h-8"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Date</label>
                <Input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  required
                  className="bg-secondary border-border text-[13px] h-8 dark:[color-scheme:dark]"
                />
              </div>
            </div>
            <Button type="submit" size="sm" className="h-7 text-[12px]" disabled={addingHoliday || !holidayName.trim() || !holidayDate}>
              {addingHoliday ? "Adding..." : "Add holiday"}
            </Button>
          </form>

          {/* Holiday list */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Holidays · {holidays.length} total
              </p>
            </div>
            {holidays.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">No holidays set yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => (
                    <tr key={h.id} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-2.5 text-[13px] font-medium">{h.name}</td>
                      <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{formatDate(h.holiday_date)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => removeHoliday(h.id)}
                          className="text-[10px] text-muted-foreground hover:text-[#f54260] transition-colors"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
