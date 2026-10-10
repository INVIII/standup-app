import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

// DELETE /api/profiles/[memberId]  - admin-only, fully removes user from auth + DB
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params

  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: caller } = await supabase
    .from("profiles")
    .select("role, team_id")
    .eq("id", user.id)
    .single()

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 })
  }

  // 2. Prevent self-deletion
  if (memberId === user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
  }

  // 3. Ensure target is in the same team
  const { data: target } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", memberId)
    .single()

  if (!target || target.team_id !== caller.team_id) {
    return NextResponse.json({ error: "Forbidden: different team" }, { status: 403 })
  }

  const service = createServiceClient()

  const { data: targetUserData } = await service.auth.admin.getUserById(memberId)
  const targetEmail = targetUserData?.user?.email ?? null

  const { error: deleteErr } = await service.auth.admin.deleteUser(memberId)
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }
  await service.from("profiles").delete().eq("id", memberId)

  if (targetEmail) {
    await service
      .from("invites")
      .delete()
      .eq("team_id", caller.team_id)
      .eq("email", targetEmail)
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params

  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: caller } = await supabase
    .from("profiles")
    .select("role, team_id")
    .eq("id", user.id)
    .single()

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 })
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", memberId)
    .single()

  if (!target || target.team_id !== caller.team_id) {
    return NextResponse.json({ error: "Forbidden: different team" }, { status: 403 })
  }

  const body: Record<string, unknown> = await req.json()
  const ALLOWED = ["team_name", "role_name", "role", "is_active"] as const
  const patch: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from("profiles")
    .update(patch)
    .eq("id", memberId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ member: data })
}
