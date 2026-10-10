import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const boardId = new URL(req.url).searchParams.get("boardId")
  if (!boardId) return NextResponse.json({ error: "boardId required" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("releases")
    .select(`*, release_issues(issue_id, issues(id, issue_number, title, type, status_id, priority, board_id, board:board_id(key)))`)
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id, role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 })

  const { board_id, name, version, description, release_date } = await req.json()
  if (!board_id || !name?.trim()) return NextResponse.json({ error: "board_id and name required" }, { status: 400 })

  const { data, error } = await supabase.from("releases").insert({
    board_id, team_id: profile.team_id, name: name.trim(),
    version: version?.trim() || null, description: description?.trim() || null,
    release_date: release_date || null, status: "unreleased",
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

  const { id, issue_id, remove_issue, ...rest } = await req.json()

  // Add/remove issue from release
  if (issue_id) {
    if (remove_issue) {
      await supabase.from("release_issues").delete().eq("release_id", id).eq("issue_id", issue_id)
    } else {
      await supabase.from("release_issues").upsert({ release_id: id, issue_id })
    }
    return NextResponse.json({ success: true })
  }

  const allowed = ["name","version","description","status","release_date"]
  const updates: Record<string, unknown> = {}
  for (const k of allowed) if (k in rest) updates[k] = rest[k]

  const { data, error } = await supabase.from("releases")
    .update(updates).eq("id", id).eq("team_id", profile.team_id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id, role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 })

  const { error } = await supabase.from("releases").delete().eq("id", id!).eq("team_id", profile.team_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
