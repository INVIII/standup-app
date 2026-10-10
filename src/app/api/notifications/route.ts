import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get("unread") === "true"

  let q = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30)

  if (unreadOnly) q = q.eq("read", false)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unreadCount = unreadOnly
    ? (data ?? []).length
    : (data ?? []).filter(n => !n.read).length

  return NextResponse.json({ notifications: data ?? [], unreadCount })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, all } = await req.json()

  if (all) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)
    return NextResponse.json({ success: true })
  }

  if (id) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
      .eq("user_id", user.id)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "id or all required" }, { status: 400 })
}
