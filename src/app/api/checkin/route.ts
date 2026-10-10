import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { todayISO } from "@/lib/utils"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { todos, tagged_issues, blockers, project_id, availability = "working", risk = false, risk_note } = body

    // Accept either tagged_issues (new) or free-text todos (legacy)
    if (!tagged_issues?.length && !todos?.trim()) {
      return NextResponse.json({ error: "todos_required" }, { status: 400 })
    }
    if (risk && !risk_note?.trim()) {
      return NextResponse.json({ error: "risk_note_required" }, { status: 400 })
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

    // Check existing — always allow updates, no time lock
    const { data: existing } = await supabase
      .from("checkins")
      .select("id, submitted_at")
      .eq("user_id", user.id)
      .eq("checkin_date", today)
      .maybeSingle()

    const payload = {
      todos: todos?.trim() || null,
      tagged_issues: tagged_issues ?? null,
      blockers: blockers || null,
      project_id: project_id || null,
      availability,
      risk: !!risk,
      risk_note: risk ? (risk_note?.trim() || null) : null,
    }

    if (existing) {
      const { data, error } = await supabase
        .from("checkins")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .single()
      if (error) throw error
      return NextResponse.json({ success: true, checkin_id: data.id })
    }

    const { data, error } = await supabase
      .from("checkins")
      .insert({
        user_id: user.id,
        team_id: profile.team_id,
        checkin_date: today,
        ...payload,
      })
      .select("id")
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, checkin_id: data.id })
  } catch (err: unknown) {
    console.error(err)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
