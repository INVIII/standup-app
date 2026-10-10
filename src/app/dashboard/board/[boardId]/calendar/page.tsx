import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CalendarView } from "@/components/board/CalendarView"

export default async function CalendarPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles").select("team_id").eq("id", user.id).single()

  const [issuesRes, statusesRes, membersRes] = await Promise.all([
    supabase
      .from("issues")
      .select(`
        id,title,issue_number,type,priority,status_id,sprint_id,assignee_id,due_date,board_id,
        workflow_status:status_id(id,name,color,category),
        assignee:assignee_id(id,name,avatar_color),
        board:board_id(key)
      `)
      .eq("board_id", boardId)
      .not("due_date", "is", null)
      .limit(300)
      .order("due_date"),
    supabase
      .from("workflow_statuses")
      .select("id,name,color,category,position,board_id")
      .eq("board_id", boardId)
      .order("position"),
    supabase
      .from("profiles")
      .select("id,name,avatar_color")
      .eq("team_id", profile?.team_id ?? "")
      .eq("is_active", true),
  ])

  return (
    <CalendarView
      boardId={boardId}
      issues={(issuesRes.data ?? []) as any}
      statuses={(statusesRes.data ?? []) as any}
      members={membersRes.data ?? []}
    />
  )
}
