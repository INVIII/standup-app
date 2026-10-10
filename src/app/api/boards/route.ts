import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })

  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("team_id", profile.team_id)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id, role").eq("id", user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })
  if (profile.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 })

  const { name, key, description } = await req.json()
  if (!name?.trim() || !key?.trim()) return NextResponse.json({ error: "name and key required" }, { status: 400 })

  const { data, error } = await supabase.from("boards").insert({
    team_id: profile.team_id,
    name: name.trim(),
    key: key.trim().toUpperCase(),
    description: description?.trim() || null,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create default workflow statuses
  const defaults = [
    { name: "To Do",           color: "#6b6b6b", category: "todo",        position: 0 },
    { name: "In Progress",     color: "#5e6ad2", category: "in_progress", position: 1 },
    { name: "Code Review",     color: "#f5a524", category: "in_progress", position: 2 },
    { name: "QA",              color: "#8b5cf6", category: "in_progress", position: 3 },
    { name: "Done",            color: "#26d97f", category: "done",        position: 4 },
  ]
  await supabase.from("workflow_statuses").insert(
    defaults.map(d => ({ ...d, board_id: data.id, team_id: profile.team_id }))
  )

  return NextResponse.json(data)
}
