import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { todayIST } from "@/lib/date"

// GET /api/history?date=YYYY-MM-DD  — admin-only: every member's SOD + EOD for a date
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles").select("team_id, role").eq("id", user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })
  if (profile.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 })

  const date = new URL(req.url).searchParams.get("date") || todayIST()

  const [{ data: checkins }, { data: eods }] = await Promise.all([
    supabase
      .from("checkins")
      .select("id, user_id, todos, blockers, risk, risk_note, availability, tagged_issues, checkin_date, submitted_at, profiles(id, name, avatar_color)")
      .eq("team_id", profile.team_id)
      .eq("checkin_date", date),
    supabase
      .from("eod_updates")
      .select("id, user_id, accomplished, pending, status, completion_pct, confidence, risk, risk_note, quality_gate, tagged_issues, eod_date, submitted_at, profiles(id, name, avatar_color)")
      .eq("team_id", profile.team_id)
      .eq("eod_date", date),
  ])

  // Resolve tagged ticket details (id → key-num + title) for display
  const ids = new Set<string>()
  for (const c of checkins ?? []) for (const t of ((c as any).tagged_issues ?? [])) if (t?.issue_id) ids.add(t.issue_id)
  for (const e of eods ?? []) for (const t of ((e as any).tagged_issues ?? [])) if (t?.issue_id) ids.add(t.issue_id)

  let tickets: Record<string, { key: string; number: number; title: string }> = {}
  if (ids.size > 0) {
    const { data: issues } = await supabase
      .from("issues")
      .select("id, issue_number, title, board:board_id(key)")
      .in("id", [...ids])
    for (const i of (issues ?? []) as any[]) {
      tickets[i.id] = { key: i.board?.key ?? "ISSUE", number: i.issue_number, title: i.title }
    }
  }

  return NextResponse.json({ date, checkins: checkins ?? [], eods: eods ?? [], tickets })
}
