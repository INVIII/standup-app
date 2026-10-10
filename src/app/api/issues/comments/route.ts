import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { insertNotifications } from "@/lib/notifications"

export async function GET(req: Request) {
  const issueId = new URL(req.url).searchParams.get("issueId")
  if (!issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("issue_comments")
    .select("*, profiles:user_id(id, name, avatar_color)")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id, name").eq("id", user.id).single()
  const { issue_id, content } = await req.json()
  if (!issue_id || !content?.trim()) return NextResponse.json({ error: "issue_id and content required" }, { status: 400 })

  const { data, error } = await supabase.from("issue_comments").insert({
    issue_id, user_id: user.id, team_id: profile!.team_id, content: content.trim(),
  }).select("*, profiles:user_id(id, name, avatar_color)").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire notifications (fire-and-forget)
  ;(async () => {
    const trimmed = content.trim()
    const notifs: Parameters<typeof insertNotifications>[0] = []

    // Fetch issue for assignee + title
    const { data: issue } = await supabase
      .from("issues")
      .select("assignee_id, title, board_id, issue_number, board:board_id(key)")
      .eq("id", issue_id)
      .single()
    if (!issue) return

    const boardKey = (issue.board as any)?.key ?? "ISSUE"
    const snippet = trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed

    // Notify assignee of new comment (not themselves)
    if (issue.assignee_id && issue.assignee_id !== user.id) {
      notifs.push({
        userId: issue.assignee_id,
        type: "comment",
        title: `${profile!.name} commented on: [${boardKey}-${issue.issue_number}] ${issue.title}`,
        body: snippet,
        issueId: issue_id,
        boardId: issue.board_id,
      })
    }

    // Parse @mentions — match @Name (first+last supported)
    const mentionMatches = [...trimmed.matchAll(/@([\w][\w\s]{0,30}?)(?=\s|$|[^\w\s])/g)]
    const mentionNames = [...new Set(mentionMatches.map(m => m[1].trim()))]

    if (mentionNames.length > 0) {
      const { data: mentioned } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("team_id", profile!.team_id)
        .in("name", mentionNames)

      for (const m of (mentioned ?? [])) {
        if (m.id !== user.id && !notifs.find(n => n.userId === m.id)) {
          notifs.push({
            userId: m.id,
            type: "mention",
            title: `${profile!.name} mentioned you in: [${boardKey}-${issue.issue_number}] ${issue.title}`,
            body: snippet,
            issueId: issue_id,
            boardId: issue.board_id,
          })
        }
      }
    }

    await insertNotifications(notifs)
  })()

  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, content } = await req.json()
  const { data, error } = await supabase.from("issue_comments")
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id)
    .select("*, profiles:user_id(id, name, avatar_color)").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id, role").eq("id", user.id).single()

  let q = supabase.from("issue_comments").delete().eq("id", id!)
  if (profile?.role !== "admin") q = q.eq("user_id", user.id)

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
