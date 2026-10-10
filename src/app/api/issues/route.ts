import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { insertNotification } from "@/lib/notifications"

const ISSUE_SELECT = `
  *,
  workflow_status:status_id(*),
  assignee:assignee_id(id, name, avatar_color),
  reporter:reporter_id(id, name, avatar_color),
  board:board_id(id, key, name)
`

export async function GET(req: Request) {
  const url = new URL(req.url)
  const boardId  = url.searchParams.get("boardId")
  const sprintId = url.searchParams.get("sprintId")   // "backlog" = null sprint
  const type     = url.searchParams.get("type")
  const parentId = url.searchParams.get("parentId")
  const issueId  = url.searchParams.get("id")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let q = supabase.from("issues").select(ISSUE_SELECT)

  if (issueId) {
    const { data, error } = await q.eq("id", issueId).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (boardId) q = q.eq("board_id", boardId)
  if (sprintId === "backlog") q = q.is("sprint_id", null)
  else if (sprintId) q = q.eq("sprint_id", sprintId)
  if (type) q = q.eq("type", type)
  if (parentId) q = q.eq("parent_id", parentId)

  // Exclude subtasks from top-level queries unless parentId specified
  if (!parentId && !issueId) q = q.neq("type", "subtask")

  const { data, error } = await q.order("rank", { ascending: true }).order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })

  const body = await req.json()
  const { board_id, type, title, description, status_id, priority, assignee_id,
          parent_id, sprint_id, story_points, start_date, due_date, labels } = body

  if (!board_id || !title?.trim()) return NextResponse.json({ error: "board_id and title required" }, { status: 400 })

  // Get default status if not provided
  let resolvedStatusId = status_id
  if (!resolvedStatusId) {
    const { data: firstStatus } = await supabase
      .from("workflow_statuses").select("id")
      .eq("board_id", board_id).order("position").limit(1).single()
    resolvedStatusId = firstStatus?.id || null
  }

  const { data, error } = await supabase.from("issues").insert({
    board_id, team_id: profile.team_id,
    issue_number: 0, // trigger sets it
    type: type || "task",
    title: title.trim(),
    description: description?.trim() || null,
    status_id: resolvedStatusId,
    priority: priority || "medium",
    assignee_id: assignee_id || null,
    reporter_id: user.id,
    parent_id: parent_id || null,
    sprint_id: sprint_id || null,
    story_points: story_points || null,
    start_date: start_date || null,
    due_date: due_date || null,
    labels: labels || [],
    rank: Date.now().toString(),
  }).select(ISSUE_SELECT).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id, name").eq("id", user.id).single()

  const body = await req.json()
  const { id, ...updates } = body

  // Fetch current issue to detect changes
  const { data: currentIssue } = await supabase
    .from("issues")
    .select("assignee_id, title, board_id, board:board_id(key, id)")
    .eq("id", id)
    .single()

  // Only allow known fields
  const allowed = ["title","description","status_id","priority","assignee_id",
                   "parent_id","sprint_id","story_points","start_date","due_date",
                   "labels","rank","type"]
  const filtered: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (k in updates) filtered[k] = updates[k]

  const { data, error } = await supabase.from("issues")
    .update(filtered).eq("id", id).eq("team_id", profile!.team_id)
    .select(ISSUE_SELECT).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire assignment notification (don't await — keep response fast)
  if ("assignee_id" in filtered && currentIssue) {
    const newAssigneeId = filtered.assignee_id as string | null
    const oldAssigneeId = currentIssue.assignee_id
    const boardKey = (currentIssue.board as any)?.key ?? "ISSUE"

    if (newAssigneeId && newAssigneeId !== user.id && newAssigneeId !== oldAssigneeId) {
      insertNotification({
        userId: newAssigneeId,
        type: "assigned",
        title: `You were assigned: [${boardKey}-${data.issue_number}] ${data.title}`,
        body: `Priority: ${data.priority}`,
        issueId: data.id,
        boardId: data.board_id,
      })
    }
    if (oldAssigneeId && !newAssigneeId && oldAssigneeId !== user.id) {
      insertNotification({
        userId: oldAssigneeId,
        type: "unassigned",
        title: `You were unassigned from: [${boardKey}-${data.issue_number}] ${data.title}`,
        issueId: data.id,
        boardId: data.board_id,
      })
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", user.id).single()
  const { error } = await supabase.from("issues").delete().eq("id", id!).eq("team_id", profile!.team_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
