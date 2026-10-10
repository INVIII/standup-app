import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BacklogView } from "@/components/board/BacklogView"

export default async function BacklogPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>
  searchParams: Promise<{ issue?: string }>
}) {
  const { boardId } = await params
  const { issue: initialIssueId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles").select("team_id,role").eq("id", user.id).single()

  const [sprintsRes, issuesRes, statusesRes, membersRes] = await Promise.all([
    supabase.from("sprints")
      .select("id,name,status,start_date,end_date,board_id,goal")
      .eq("board_id", boardId).order("created_at"),
    supabase.from("issues").select(`
      id,title,issue_number,type,priority,status_id,sprint_id,assignee_id,rank,story_points,board_id,labels,parent_id,due_date,description,reporter_id,start_date,
      workflow_status:status_id(id,name,color,category),
      assignee:assignee_id(id,name,avatar_color),
      board:board_id(key)
    `).eq("board_id", boardId)
      .limit(600).order("rank").order("created_at"),
    supabase.from("workflow_statuses")
      .select("id,name,color,category,position,board_id")
      .eq("board_id", boardId).order("position"),
    supabase.from("profiles")
      .select("id,name,avatar_color")
      .eq("team_id", profile!.team_id).eq("is_active", true),
  ])

  return (
    <BacklogView
      boardId={boardId}
      sprints={(sprintsRes.data ?? []) as any}
      allIssues={(issuesRes.data ?? []) as any}
      statuses={(statusesRes.data ?? []) as any}
      members={membersRes.data ?? []}
      isAdmin={profile?.role === "admin"}
      currentUserId={user.id}
      initialIssueId={initialIssueId}
    />
  )
}
