import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { todayISO } from "@/lib/utils"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { accomplished, pending, status, tagged_issues, completion_pct, confidence, risk = false, risk_note, quality_gate } = body

    if (!accomplished?.trim() && !tagged_issues?.length) {
      return NextResponse.json({ error: "accomplished_required" }, { status: 400 })
    }

    const validStatuses = ["done", "partial", "blocked"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 })
    }
    if (risk && !risk_note?.trim()) {
      return NextResponse.json({ error: "risk_note_required" }, { status: 400 })
    }
    if (confidence && !["high", "medium", "low"].includes(confidence)) {
      return NextResponse.json({ error: "invalid_confidence" }, { status: 400 })
    }
    const pct = completion_pct == null ? null : Math.max(0, Math.min(100, Math.round(Number(completion_pct) || 0)))
    if (quality_gate?.needs_review && !quality_gate?.review_what_whom?.trim()) {
      return NextResponse.json({ error: "review_detail_required" }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", user.id)
      .single()

    if (!profile?.team_id) {
      return NextResponse.json({ error: "no_team" }, { status: 400 })
    }

    const today = todayISO()

    // Get today's checkin
    const { data: todayCheckin } = await supabase
      .from("checkins")
      .select("id")
      .eq("user_id", user.id)
      .eq("checkin_date", today)
      .maybeSingle()

    // Check existing EOD
    const { data: existing } = await supabase
      .from("eod_updates")
      .select("id")
      .eq("user_id", user.id)
      .eq("eod_date", today)
      .maybeSingle()

    // Always allow updates, no time lock
    const payload = {
      user_id: user.id,
      team_id: profile.team_id,
      checkin_id: todayCheckin?.id ?? null,
      accomplished: accomplished?.trim() || null,
      tagged_issues: tagged_issues ?? null,
      pending: pending?.trim() || null,
      status,
      completion_pct: pct,
      confidence: confidence || null,
      risk: !!risk,
      risk_note: risk ? (risk_note?.trim() || null) : null,
      quality_gate: quality_gate ?? null,
      eod_date: today,
    }

    let data, error
    if (existing) {
      ({ data, error } = await supabase
        .from("eod_updates")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single())
    } else {
      ({ data, error } = await supabase
        .from("eod_updates")
        .insert(payload)
        .select()
        .single())
    }

    if (error) throw error

    const warning = !todayCheckin ? "no_sod_today" : undefined
    return NextResponse.json({ success: true, id: data.id, ...(warning ? { warning } : {}) })
  } catch (err: unknown) {
    console.error(err)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
