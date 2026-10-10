import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { insertNotifications } from "@/lib/notifications"

export async function GET(req: Request) {
  const boardId = new URL(req.url).searchParams.get("boardId")
  if (!boardId) return NextResponse.json({ error: "boardId required" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("sprints")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id, role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 })

  const { board_id, name, goal, start_date, end_date } = await req.json()
  if (!board_id || !name?.trim()) return NextResponse.json({ error: "board_id and name required" }, { status: 400 })

  const { data, error } = await supabase.from("sprints").insert({
    board_id, team_id: profile.team_id, name: name.trim(),
    goal: goal?.trim() || null, start_date: start_date || null, end_date: end_date || null,
    status: "planning",
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

  const {
    id, action, name, goal, start_date, end_date, incomplete_to_sprint_id,
    // start-flow resolution: how to handle an already-active sprint
    resolve_active,          // boolean — caller acknowledged & chose how to resolve
    active_incomplete_to,    // null = backlog, or a sprint id to move incomplete items into
  } = await req.json()

  if (action === "start") {
    const { data: sprint } = await supabase.from("sprints").select("board_id").eq("id", id).single()
    if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 404 })

    // Is there already another active sprint on this board?
    const { data: actives } = await supabase.from("sprints")
      .select("id, name")
      .eq("board_id", sprint.board_id)
      .eq("status", "active")
      .neq("id", id)

    if (actives && actives.length > 0) {
      // Require the caller to explicitly decide what to do — no silent demotion
      if (!resolve_active) {
        return NextResponse.json(
          { error: "active_sprint_exists", activeSprint: actives[0] },
          { status: 409 }
        )
      }
      // Resolve: complete each currently-active sprint, moving its incomplete
      // issues either to the backlog (null) or into another sprint.
      const moveTo = active_incomplete_to ?? null
      const doneFilter = `(select id from workflow_statuses where category = 'done' and board_id = '${sprint.board_id}')`
      for (const a of actives) {
        await supabase.from("issues")
          .update({ sprint_id: moveTo })
          .eq("sprint_id", a.id)
          .not("status_id", "in", doneFilter)
        await supabase.from("sprints")
          .update({ status: "completed" })
          .eq("id", a.id)
          .eq("team_id", profile.team_id)
      }
    }

    const { data, error } = await supabase.from("sprints")
      .update({ status: "active" }).eq("id", id).eq("team_id", profile.team_id)
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify all assignees who have issues in this sprint
    ;(async () => {
      const { data: sprintIssues } = await supabase
        .from("issues")
        .select("assignee_id, board_id")
        .eq("sprint_id", id)
        .not("assignee_id", "is", null)
      const uniqueAssignees = [...new Set((sprintIssues ?? []).map(i => i.assignee_id).filter(Boolean))] as string[]
      await insertNotifications(
        uniqueAssignees
          .filter(uid => uid !== user.id)
          .map(uid => ({
            userId: uid,
            type: "sprint_started" as const,
            title: `Sprint "${data.name}" has started`,
            boardId: sprint?.board_id,
          }))
      )
    })()

    return NextResponse.json(data)
  }

  if (action === "reopen") {
    const { data, error } = await supabase.from("sprints")
      .update({ status: "active" }).eq("id", id).eq("team_id", profile.team_id)
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Revert a mistaken "start" — move an active sprint back to planning
  if (action === "unstart") {
    const { data, error } = await supabase.from("sprints")
      .update({ status: "planning" }).eq("id", id).eq("team_id", profile.team_id)
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === "complete") {
    // Move incomplete issues to another sprint or backlog
    const moveToSprint = incomplete_to_sprint_id || null

    // Fetch incomplete issues before moving (for notifications)
    const { data: incompleteIssues } = await supabase
      .from("issues")
      .select("assignee_id, board_id, title, issue_number")
      .eq("sprint_id", id)
      .not("status_id", "in", `(select id from workflow_statuses where category = 'done' and board_id = (select board_id from sprints where id = '${id}'))`)

    await supabase.from("issues")
      .update({ sprint_id: moveToSprint })
      .eq("sprint_id", id)
      .not("status_id", "in", `(select id from workflow_statuses where category = 'done' and board_id = (select board_id from sprints where id = '${id}'))`)

    const { data, error } = await supabase.from("sprints")
      .update({ status: "completed" }).eq("id", id).eq("team_id", profile.team_id)
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify assignees whose issues were moved to backlog
    ;(async () => {
      const notifiable = (incompleteIssues ?? []).filter(i => i.assignee_id && i.assignee_id !== user.id)
      await insertNotifications(
        notifiable.map(i => ({
          userId: i.assignee_id!,
          type: "sprint_completed" as const,
          title: `Sprint "${data.name}" completed — your issue was moved to ${moveToSprint ? "next sprint" : "backlog"}`,
          boardId: i.board_id,
        }))
      )
    })()

    return NextResponse.json(data)
  }

  // Plain update
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (goal !== undefined) updates.goal = goal
  if (start_date !== undefined) updates.start_date = start_date
  if (end_date !== undefined) updates.end_date = end_date

  const { data, error } = await supabase.from("sprints")
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

  // Move issues to backlog
  await supabase.from("issues").update({ sprint_id: null }).eq("sprint_id", id)
  const { error } = await supabase.from("sprints").delete().eq("id", id).eq("team_id", profile.team_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
