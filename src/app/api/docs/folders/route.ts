import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Helper: current user + profile (team, role)
async function getCaller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }
  const { data: profile } = await supabase
    .from("profiles").select("team_id, role").eq("id", user.id).single()
  return { supabase, user, profile }
}

// POST /api/docs/folders  — create a folder or subfolder
export async function POST(req: Request) {
  const { supabase, user, profile } = await getCaller()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })

  const { name, parent_id } = await req.json().catch(() => ({}))
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

  // If a parent is given, ensure it belongs to this team
  if (parent_id) {
    const { data: parent } = await supabase
      .from("doc_folders").select("team_id").eq("id", parent_id).maybeSingle()
    if (!parent || parent.team_id !== profile.team_id) {
      return NextResponse.json({ error: "invalid_parent" }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from("doc_folders")
    .insert({ team_id: profile.team_id, parent_id: parent_id ?? null, name: name.trim(), created_by: user.id })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/docs/folders  — rename (owner or admin, enforced by RLS)
export async function PATCH(req: Request) {
  const { supabase, user, profile } = await getCaller()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, name } = await req.json().catch(() => ({}))
  if (!id || !name?.trim()) return NextResponse.json({ error: "id and name required" }, { status: 400 })

  const { data, error } = await supabase
    .from("doc_folders").update({ name: name.trim() }).eq("id", id).select("*").maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "not_allowed" }, { status: 403 })
  return NextResponse.json(data)
}

// DELETE /api/docs/folders?id=  — cascades to subfolders + links (owner or admin)
export async function DELETE(req: Request) {
  const { supabase, user } = await getCaller()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { data, error } = await supabase
    .from("doc_folders").delete().eq("id", id).select("id").maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "not_allowed" }, { status: 403 })
  return NextResponse.json({ success: true })
}
