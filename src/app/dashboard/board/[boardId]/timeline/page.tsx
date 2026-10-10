import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TimelineView } from "@/components/board/TimelineView"

export default async function TimelinePage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [sprintsRes, epicsRes, releasesRes] = await Promise.all([
    supabase.from("sprints").select("*").eq("board_id", boardId).order("start_date"),
    supabase.from("issues")
      .select("id, issue_number, title, type, status_id, start_date, due_date, board_id, board:board_id(key), workflow_status:status_id(name,color,category)")
      .eq("board_id", boardId)
      .eq("type", "epic")
      .order("created_at"),
    supabase.from("releases")
      .select("id, name, version, status, release_date")
      .eq("board_id", boardId)
      .order("release_date"),
  ])

  return (
    <TimelineView
      boardId={boardId}
      sprints={sprintsRes.data ?? []}
      epics={(epicsRes.data ?? []) as any}
      releases={releasesRes.data ?? []}
    />
  )
}
