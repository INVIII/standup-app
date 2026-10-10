import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AvailabilityView } from "@/components/board/AvailabilityView"
import { toLocalISO } from "@/lib/date"

export default async function AvailabilityPage({ params }: { params: Promise<{ boardId: string }> }) {
  await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.team_id) {
    return <AvailabilityView />
  }

  const tid = profile.team_id
  const thirtyAgo = toLocalISO(new Date(Date.now() - 30 * 86400000))
  const sixtyAhead = toLocalISO(new Date(Date.now() + 60 * 86400000))

  const [membersRes, leavesRes, holidaysRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,name,avatar_color,role")
      .eq("team_id", tid)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("leaves")
      .select("id,profile_id,leave_date,leave_type,reason")
      .eq("team_id", tid)
      .gte("leave_date", thirtyAgo)
      .lte("leave_date", sixtyAhead)
      .order("leave_date"),
    supabase
      .from("holidays")
      .select("id,name,holiday_date")
      .eq("team_id", tid)
      .gte("holiday_date", thirtyAgo)
      .order("holiday_date"),
  ])

  return (
    <AvailabilityView
      initialMembers={(membersRes.data ?? []) as any}
      initialLeaves={(leavesRes.data ?? []) as any}
      initialHolidays={(holidaysRes.data ?? []) as any}
      initialCurrentUserId={user.id}
      initialTeamId={tid}
      initialIsAdmin={profile.role === "admin"}
    />
  )
}
