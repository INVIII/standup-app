import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const issueId = new URL(req.url).searchParams.get("issueId")
  if (!issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("issue_attachments")
    .select("*")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })

  const formData = await req.formData()
  const file = formData.get("file") as File
  const issueId = formData.get("issueId") as string

  if (!file || !issueId) return NextResponse.json({ error: "file and issueId required" }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 })

  const safeName = file.name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-") 
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "") || "file"
  const path = `${profile.team_id}/${issueId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from("issue-attachments")
    .upload(path, file, { contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from("issue-attachments")
    .getPublicUrl(path)

  const { data, error } = await supabase.from("issue_attachments").insert({
    issue_id: issueId,
    user_id: user.id,
    team_id: profile.team_id,
    file_name: file.name,
    file_url: publicUrl,
    file_type: file.type,
    file_size: file.size,
  }).select().single()

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

  const { data: attachment } = await supabase.from("issue_attachments").select("*").eq("id", id).single()
  if (!attachment) return NextResponse.json({ error: "not found" }, { status: 404 })

  // Extract path from URL
  const url = new URL(attachment.file_url)
  const storagePath = url.pathname.split("/object/public/issue-attachments/")[1]
  if (storagePath) {
    await supabase.storage.from("issue-attachments").remove([storagePath])
  }

  let q = supabase.from("issue_attachments").delete().eq("id", id)
  if (profile?.role !== "admin") q = q.eq("user_id", user.id)

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
