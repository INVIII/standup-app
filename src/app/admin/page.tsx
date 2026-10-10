import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", user.id).single()
  if (!profile?.team_id) return null

  const [{ count: memberCount }, { count: projectCount }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("team_id", profile.team_id).eq("is_active", true),
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("team_id", profile.team_id).eq("is_active", true),
  ])

  const sections = [
    {
      href: "/admin/members",
      label: "Members",
      desc: `${memberCount ?? 0} active member${memberCount !== 1 ? "s" : ""}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 6a5 5 0 0 1 10 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm2.5 5a3 3 0 0 0-3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: "/admin/projects",
      label: "Projects",
      desc: `${projectCount ?? 0} active project${projectCount !== 1 ? "s" : ""}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2 4A1.5 1.5 0 0 1 3.5 2.5h4L9 4.5H15A1.5 1.5 0 0 1 16.5 6V14A1.5 1.5 0 0 1 15 15.5H3A1.5 1.5 0 0 1 1.5 14V4Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ]

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[15px] font-semibold">Admin</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Manage your team and workspace</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <div className="bg-card border border-border rounded-lg p-4 hover:bg-secondary hover:border-border/80 transition-all cursor-pointer group">
              <div className="w-8 h-8 rounded-lg bg-secondary group-hover:bg-muted flex items-center justify-center text-muted-foreground mb-3 transition-colors">
                {s.icon}
              </div>
              <p className="text-[13px] font-medium mb-0.5">{s.label}</p>
              <p className="text-[12px] text-muted-foreground">{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
