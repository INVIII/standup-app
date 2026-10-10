import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ReleasesView } from "@/components/board/ReleasesView"
import type { Issue } from "@/types/database"

export default async function ReleasesPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  const [releasesRes, issuesRes] = await Promise.all([
    supabase.from("releases")
      .select("*, release_issues(issue_id)")
      .eq("board_id", boardId).order("created_at", { ascending: false }),
    supabase.from("issues")
      .select("id, issue_number, title, type, status_id, board_id, board:board_id(key)")
      .eq("board_id", boardId).neq("type", "subtask").order("issue_number"),
  ])

  return (
    <ReleasesView
      boardId={boardId}
      releases={releasesRes.data ?? []}
      allIssues={(issuesRes.data ?? []) as unknown as Issue[]}
      isAdmin={profile?.role === "admin"}
    />
  )
}
