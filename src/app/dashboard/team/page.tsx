import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TeamPageClient } from "@/components/dashboard/TeamPageClient"

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.team_id) redirect("/onboarding")

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,name,email,role,avatar_color,is_active,team_id,team_name,role_name,created_at")
      .eq("team_id", profile.team_id)
      .order("name"),
    profile.role === "admin"
      ? supabase
          .from("invites")
          .select("id, email, token, created_at, expires_at, used_at")
          .eq("team_id", profile.team_id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
      : { data: [] },
  ])

  return (
    <div className="h-full overflow-y-auto p-5 md:p-6 lg:p-8">
      <TeamPageClient
        initialMembers={(members ?? []) as any}
        initialInvites={(invites ?? []) as any}
        isAdmin={profile.role === "admin"}
        currentUserId={user.id}
      />
    </div>
  )
}
