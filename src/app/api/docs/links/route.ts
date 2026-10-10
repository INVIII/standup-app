import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function getCaller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }
  const { data: profile } = await supabase
    .from("profiles").select("team_id, role").eq("id", user.id).single()
  return { supabase, user, profile }
}

const LINK_SELECT = "*, creator:created_by(id, name, avatar_color)"

// Normalise a URL — prepend https:// if the user omitted the scheme
function normaliseUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try { new URL(withScheme); return withScheme } catch { return null }
}

// POST /api/docs/links  — add a documentation link
export async function POST(req: Request) {
  const { supabase, user, profile } = await getCaller()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })

  const { title, url, description, folder_id } = await req.json().catch(() => ({}))
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })
  const safeUrl = normaliseUrl(url ?? "")
  if (!safeUrl) return NextResponse.json({ error: "valid url required" }, { status: 400 })

  if (folder_id) {
    const { data: folder } = await supabase
      .from("doc_folders").select("team_id").eq("id", folder_id).maybeSingle()
    if (!folder || folder.team_id !== profile.team_id) {
      return NextResponse.json({ error: "invalid_folder" }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from("doc_links")
    .insert({
      team_id: profile.team_id,
      folder_id: folder_id ?? null,
      title: title.trim(),
      url: safeUrl,
      description: description?.trim() || null,
      created_by: user.id,
    })
    .select(LINK_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/docs/links  — edit (owner or admin, enforced by RLS)
export async function PATCH(req: Request) {
  const { supabase, user } = await getCaller()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, title, url, description, folder_id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title !== undefined) {
    if (!title.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })
    patch.title = title.trim()
  }
  if (url !== undefined) {
    const safeUrl = normaliseUrl(url ?? "")
    if (!safeUrl) return NextResponse.json({ error: "valid url required" }, { status: 400 })
    patch.url = safeUrl
  }
  if (description !== undefined) patch.description = description?.trim() || null
  if (folder_id !== undefined) patch.folder_id = folder_id ?? null

  const { data, error } = await supabase
    .from("doc_links").update(patch).eq("id", id).select(LINK_SELECT).maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "not_allowed" }, { status: 403 })
  return NextResponse.json(data)
}

// DELETE /api/docs/links?id=  — owner or admin
export async function DELETE(req: Request) {
  const { supabase, user } = await getCaller()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { data, error } = await supabase
    .from("doc_links").delete().eq("id", id).select("id").maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "not_allowed" }, { status: 403 })
  return NextResponse.json({ success: true })
}
