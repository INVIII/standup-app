import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const boardId = new URL(req.url).searchParams.get("boardId")
  if (!boardId) return NextResponse.json({ error: "boardId required" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("workflow_statuses")
    .select("*")
    .eq("board_id", boardId)
    .order("position", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id, role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 })

  const { board_id, name, color, category, position } = await req.json()

  const { data, error } = await supabase.from("workflow_statuses").insert({
    board_id, team_id: profile.team_id, name, color: color || "#6b6b6b",
    category: category || "todo", position: position ?? 0,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id, role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 })

  const { id, name, color, category, position } = await req.json()
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (color !== undefined) updates.color = color
  if (category !== undefined) updates.category = category
  if (position !== undefined) updates.position = position

  const { data, error } = await supabase.from("workflow_statuses")
    .update(updates).eq("id", id).eq("team_id", profile.team_id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id, role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 })

  const { error } = await supabase.from("workflow_statuses").delete().eq("id", id).eq("team_id", profile.team_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
