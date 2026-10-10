import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DocumentationClient } from "@/components/dashboard/DocumentationClient"

export default async function DocumentationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles").select("team_id, role").eq("id", user.id).single()
  if (!profile?.team_id) redirect("/onboarding")

  const [{ data: folders }, { data: links }] = await Promise.all([
    supabase
      .from("doc_folders")
      .select("*")
      .eq("team_id", profile.team_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("doc_links")
      .select("*, creator:created_by(id, name, avatar_color)")
      .eq("team_id", profile.team_id)
      .order("created_at", { ascending: true }),
  ])

  return (
    <div className="h-full overflow-y-auto p-5 md:p-6 lg:p-8">
      <DocumentationClient
        initialFolders={(folders ?? []) as any}
        initialLinks={(links ?? []) as any}
        isAdmin={profile.role === "admin"}
        currentUserId={user.id}
      />
    </div>
  )
}
