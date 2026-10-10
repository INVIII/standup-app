import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim()
  if (!q) return NextResponse.json({ issues: [], members: [] })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", user.id)
    .single()
  if (!profile?.team_id) return NextResponse.json({ issues: [], members: [] })

  // Search issues and members in parallel
  const isNumber = /^\d+$/.test(q)

  const [issuesRes, membersRes] = await Promise.all([
    // Issues: match title OR issue_number
    isNumber
      ? supabase
          .from("issues")
          .select("id, issue_number, title, type, priority, board_id, board:board_id(id,key), workflow_status:status_id(name,color)")
          .eq("team_id", profile.team_id)
          .neq("type", "subtask")
          .eq("issue_number", parseInt(q))
          .limit(10)
      : supabase
          .from("issues")
          .select("id, issue_number, title, type, priority, board_id, board:board_id(id,key), workflow_status:status_id(name,color)")
          .eq("team_id", profile.team_id)
          .neq("type", "subtask")
          .ilike("title", `%${q}%`)
          .order("created_at", { ascending: false })
          .limit(8),
    // Members: match name
    supabase
      .from("profiles")
      .select("id, name, avatar_color, email")
      .eq("team_id", profile.team_id)
      .eq("is_active", true)
      .ilike("name", `%${q}%`)
      .limit(4),
  ])

  return NextResponse.json({
    issues: issuesRes.data ?? [],
    members: membersRes.data ?? [],
  })
}
