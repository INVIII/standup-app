import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BoardSummaryView } from "@/components/board/BoardSummaryView"

export default async function BoardSummaryPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const sevenDaysAhead = new Date(Date.now() + 7 * 86400000).toISOString()

  const [issuesRes, statusesRes, membersRes, commentsRes, sprintsRes] = await Promise.all([
    supabase.from("issues")
      .select("id, title, type, priority, status_id, assignee_id, story_points, due_date, created_at, updated_at, sprint_id, board_id, workflow_status:status_id(id,name,color,category)")
      .eq("board_id", boardId)
      .neq("type", "subtask"),
    supabase.from("workflow_statuses").select("*").eq("board_id", boardId).order("position"),
    supabase.from("profiles").select("id, name, avatar_color"),
    supabase.from("issue_comments")
      .select("id, content, created_at, user_id, issue_id, user:user_id(name,avatar_color), issue:issue_id(title,board_id)" as any)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("sprints").select("*").eq("board_id", boardId).order("created_at"),
  ])

  // Compute stats
  const issues = issuesRes.data ?? []
  const now = Date.now()
  const stats = {
    completed: issues.filter(i =>
      (i as any).workflow_status?.category === "done" &&
      new Date(i.updated_at).getTime() > now - 7 * 86400000
    ).length,
    created: issues.filter(i => new Date(i.created_at).getTime() > now - 7 * 86400000).length,
    dueSoon: issues.filter(i => {
      if (!i.due_date) return false
      const d = new Date(i.due_date).getTime()
      return d >= now && d <= now + 7 * 86400000
    }).length,
    overdue: issues.filter(i => {
      if (!i.due_date) return false
      const ws = (i as any).workflow_status
      return new Date(i.due_date).getTime() < now && ws?.category !== "done"
    }).length,
  }

  return (
    <BoardSummaryView
      boardId={boardId}
      issues={issues as any}
      statuses={statusesRes.data ?? []}
      members={membersRes.data ?? []}
      recentComments={(commentsRes.data ?? []) as any}
      sprints={sprintsRes.data ?? []}
      stats={stats}
    />
  )
}
