import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SettingsClient } from "@/components/settings/SettingsClient"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,name,email,role,avatar_color,team_id,teams(id,name,timezone)")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/login")

  const team = (profile as any).teams as { id: string; name: string; timezone?: string } | null

  return (
    <div className="h-full overflow-y-auto p-5 md:p-6 lg:p-8">
      <SettingsClient
        profile={{
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          avatar_color: profile.avatar_color ?? null,
          team_id: profile.team_id ?? null,
        }}
        teamName={team?.name ?? ""}
        timezone={team?.timezone ?? "Asia/Kolkata"}
        isAdmin={profile.role === "admin"}
      />
    </div>
  )
}
