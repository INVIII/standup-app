import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { todayISO } from "@/lib/utils"

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const date = url.searchParams.get("date") ?? todayISO()

    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", user.id).single()
    if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })

    const teamId = profile.team_id

    const [{ data: projects }, { data: checkins }, { data: eods }] = await Promise.all([
      supabase.from("projects").select("id, name, color").eq("team_id", teamId).eq("is_active", true),
      supabase.from("checkins").select("user_id, project_id, todos, blockers").eq("team_id", teamId).eq("checkin_date", date),
      supabase.from("eod_updates").select("user_id, accomplished").eq("team_id", teamId).eq("eod_date", date),
    ])

    const result = (projects ?? []).map((project) => {
      const projectCheckins = (checkins ?? []).filter((c) => c.project_id === project.id)
      const memberIds = projectCheckins.map((c) => c.user_id)
      const projectEods = (eods ?? []).filter((e) => memberIds.includes(e.user_id))

      const todoCount = projectCheckins.reduce(
        (sum, c) => sum + c.todos.split("\n").filter(Boolean).length, 0
      )
      const doneCount = projectEods.reduce(
        (sum, e) => sum + e.accomplished.split("\n").filter(Boolean).length, 0
      )

      return {
        project_id: project.id,
        project_name: project.name,
        color: project.color,
        members: memberIds.length,
        todo_count: todoCount,
        done_count: doneCount,
        completion_pct: todoCount > 0 ? Math.round((doneCount / todoCount) * 100) : 0,
        has_blockers: projectCheckins.some((c) => c.blockers),
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
