import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function IssuePage({
  params,
}: {
  params: Promise<{ issueId: string }>
}) {
  const { issueId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/issue/${issueId}`)

  // Look up the issue just to get its board_id
  const { data: issue } = await supabase
    .from("issues")
    .select("id, board_id")
    .eq("id", issueId)
    .single()

  if (!issue) redirect("/dashboard")

  // Redirect to the backlog for that board with the panel pre-opened
  redirect(`/dashboard/board/${issue.board_id}/backlog?issue=${issueId}`)
}
