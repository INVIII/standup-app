import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { KanbanView } from "@/components/board/KanbanView"

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles").select("team_id,role").eq("id", user.id).single()

  const [sprintRes, statusesRes, issuesRes, membersRes] = await Promise.all([
    // Defensive: if more than one sprint is somehow active, take the most recent
    // rather than erroring out (which previously showed "no active sprint").
    supabase.from("sprints")
      .select("id,name,status,start_date,end_date,board_id")
      .eq("board_id", boardId).eq("status", "active")
      .order("start_date", { ascending: false, nullsFirst: false })
      .limit(1).maybeSingle(),
    supabase.from("workflow_statuses")
      .select("id,name,color,category,position,board_id")
      .eq("board_id", boardId).order("position"),
    supabase.from("issues").select(`
      id,title,issue_number,type,priority,status_id,sprint_id,assignee_id,rank,story_points,board_id,labels,parent_id,due_date,description,reporter_id,start_date,
      workflow_status:status_id(id,name,color,category),
      assignee:assignee_id(id,name,avatar_color),
      board:board_id(key)
    `).eq("board_id", boardId).neq("type","subtask")
      .limit(300).order("rank").order("created_at"),
    supabase.from("profiles")
      .select("id,name,avatar_color")
      .eq("team_id", profile!.team_id).eq("is_active", true),
  ])

  return (
    <KanbanView
      boardId={boardId}
      activeSprint={sprintRes.data as any}
      statuses={(statusesRes.data ?? []) as any}
      allIssues={(issuesRes.data ?? []) as any}
      members={membersRes.data ?? []}
      isAdmin={profile?.role === "admin"}
      currentUserId={user.id}
    />
  )
}
