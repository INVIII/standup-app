import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BoardShell } from "@/components/board/BoardShell"

export default async function BoardIdLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ boardId: string }>
}) {
  const { boardId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, teams(*)")
    .eq("id", user.id)
    .single()

  if (!profile?.team_id) redirect("/onboarding")

  const [{ data: boards }, { data: statuses }] = await Promise.all([
    supabase.from("boards").select("*").eq("team_id", profile.team_id).order("created_at"),
    supabase.from("workflow_statuses")
      .select("id,name,color,category,position,board_id")
      .eq("board_id", boardId).order("position"),
  ])

  return (
    <BoardShell
      boards={boards ?? []}
      activeBoardId={boardId}
      profile={profile}
      statuses={(statuses ?? []) as any}
    >
      {children}
    </BoardShell>
  )
}
