import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role, team_id").eq("id", user.id).single()
  if (profile?.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 })

  const { summaryId } = await req.json()
  if (!summaryId) return Response.json({ error: "summaryId required" }, { status: 400 })

  const service = createServiceClient()

  // Fetch existing summary (with token - ensure same team)
  const { data: existing, error: fetchErr } = await service
    .from("daily_summaries")
    .select("id, share_token, team_id")
    .eq("id", summaryId)
    .eq("team_id", profile.team_id)
    .single()

  if (fetchErr || !existing) return Response.json({ error: "Summary not found" }, { status: 404 })

  // If token already exists, return it
  if (existing.share_token) {
    return Response.json({ token: existing.share_token })
  }

  // Generate and save token
  const { data: updated, error: updateErr } = await service
    .from("daily_summaries")
    .update({ share_token: crypto.randomUUID() })
    .eq("id", summaryId)
    .select("share_token")
    .single()

  if (updateErr || !updated) return Response.json({ error: "Failed to generate token" }, { status: 500 })

  return Response.json({ token: updated.share_token })
}
