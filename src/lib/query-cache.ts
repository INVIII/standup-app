import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

/**
 * React.cache() deduplicates calls within a single server render tree.
 * When multiple layouts/pages call getCachedUser() in the same request,
 * only one DB round-trip is made.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

/**
 * Workflow statuses are fetched by both the board layout (for BoardShell tabs)
 * and by individual board tab pages. React.cache() ensures one query per request.
 */
export const getCachedWorkflowStatuses = cache(async (boardId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("workflow_statuses")
    .select("id,name,color,category,position,board_id")
    .eq("board_id", boardId)
    .order("position")
  return data ?? []
})
