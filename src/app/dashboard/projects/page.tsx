import { createClient } from "@/lib/supabase/server"
import { todayISO } from "@/lib/utils"
import type { Profile, Project, Milestone, Checkin, EODUpdate } from "@/types/database"

function daysUntil(date: string | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single() as { data: Profile | null }
  if (!profile) return null

  const today = todayISO()
  const teamId = profile.team_id!

  const [{ data: projects }, { data: milestones }, { data: checkins }, { data: eods }] = await Promise.all([
    supabase.from("projects").select("*").eq("team_id", teamId).eq("is_active", true).neq("status", "done").order("created_at"),
    supabase.from("milestones").select("*").eq("team_id", teamId).order("sort_order"),
    supabase.from("checkins").select("*, profiles(name, avatar_color)").eq("team_id", teamId).eq("checkin_date", today),
    supabase.from("eod_updates").select("*").eq("team_id", teamId).eq("eod_date", today),
  ])

  const allProjects: Project[] = projects ?? []
  const allMilestones: Milestone[] = milestones ?? []
  const allCheckins: (Checkin & { profiles: { name: string; avatar_color: string } })[] = (checkins as never[]) ?? []
  const allEods: EODUpdate[] = eods ?? []

  const isAdmin = profile.role === "admin"

  type ProjectRow = {
    project: Project
    milestones: Milestone[]
    activeDevs: { name: string; avatar_color: string }[]
    todoCount: number
    doneCount: number
    hasBlockers: boolean
  }

  const rows: ProjectRow[] = allProjects.map((project) => {
    const pms = allMilestones.filter((m) => m.project_id === project.id)
    const pCheckins = allCheckins.filter((c) => c.project_id === project.id)
    const pUserIds = pCheckins.map((c) => c.user_id)
    const pEods = allEods.filter((e) => pUserIds.includes(e.user_id))
    const todoCount = pCheckins.reduce((s, c) => s + c.todos.split("\n").filter(Boolean).length, 0)
    const doneCount = pEods.reduce((s, e) => s + e.accomplished.split("\n").filter(Boolean).length, 0)
    return {
      project,
      milestones: pms,
      activeDevs: pCheckins.slice(0, 5).map((c) => ({ name: c.profiles.name, avatar_color: c.profiles.avatar_color })),
      todoCount,
      doneCount,
      hasBlockers: pCheckins.some((c) => c.blockers),
    }
  })

  const STATUS_COLORS: Record<string, string> = {
    backlog: "#6b6b6b", active: "#5e6ad2", qa: "#f5a524",
    staging: "#26a69a", production: "#26d97f", on_hold: "#8b8b8b",
  }

  const STATUS_LABELS: Record<string, string> = {
    backlog: "Backlog", active: "Active", qa: "QA",
    staging: "Staging", production: "Production", on_hold: "On Hold",
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-[15px] font-semibold">Projects</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Active projects and today&apos;s progress</p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mx-auto mb-3">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4A1.5 1.5 0 0 1 3.5 2.5h4L9 4.5H15A1.5 1.5 0 0 1 16.5 6V14A1.5 1.5 0 0 1 15 15.5H3A1.5 1.5 0 0 1 1.5 14V4Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" />
            </svg>
          </div>
          <p className="text-[13px] text-muted-foreground mb-1">No active projects</p>
          {isAdmin && (
            <a href="/admin/projects" className="text-[12px] text-primary hover:underline">
              Create a project →
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(({ project, milestones: pms, activeDevs, todoCount, doneCount, hasBlockers }) => {
            const totalMs = pms.length
            const doneMs = pms.filter((m) => m.is_done).length
            const msPct = totalMs > 0 ? Math.round((doneMs / totalMs) * 100) : null
            const days = daysUntil(project.end_date)

            return (
              <div key={project.id} className="bg-card border border-border rounded-lg p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: project.color }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-medium">{project.name}</p>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            color: STATUS_COLORS[project.status] ?? "#6b6b6b",
                            backgroundColor: (STATUS_COLORS[project.status] ?? "#6b6b6b") + "18",
                          }}
                        >
                          {STATUS_LABELS[project.status] ?? project.status}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{project.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {hasBlockers && (
                      <span className="text-[10px] font-medium text-[#f5a524] bg-[#f5a524]/10 px-1.5 py-0.5 rounded">Blocker</span>
                    )}
                    {days !== null && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          color: days < 0 ? "#f54260" : days <= 3 ? "#f5a524" : "#6b6b6b",
                          backgroundColor: (days < 0 ? "#f54260" : days <= 3 ? "#f5a524" : "#6b6b6b") + "15",
                        }}
                      >
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Milestones progress */}
                {totalMs > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-muted-foreground">Milestones · {doneMs}/{totalMs}</p>
                      {msPct !== null && <p className="text-[10px] text-muted-foreground">{msPct}%</p>}
                    </div>
                    <div className="h-[3px] bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${msPct}%`, backgroundColor: project.color }}
                      />
                    </div>
                    {/* Recent milestones */}
                    <div className="mt-2 space-y-1">
                      {pms.slice(0, 3).map((m) => (
                        <div key={m.id} className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                            m.is_done ? "bg-[#26d97f] border-[#26d97f]" : "border-border"
                          }`}>
                            {m.is_done && (
                              <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                                <path d="M1 3.5l1.5 1.5 3.5-3.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-[11px] ${m.is_done ? "line-through text-muted-foreground" : "text-foreground/80"}`}>
                            {m.title}
                          </span>
                        </div>
                      ))}
                      {totalMs > 3 && (
                        <p className="text-[10px] text-muted-foreground pl-5">+{totalMs - 3} more</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer: devs + today's activity */}
                <div className="flex items-center justify-between pt-2.5 border-t border-border">
                  <div className="flex items-center gap-0.5">
                    {activeDevs.map((d, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white border border-card"
                        style={{ backgroundColor: d.avatar_color ?? "#5e6ad2", marginLeft: i > 0 ? "-4px" : "0" }}
                        title={d.name}
                      >
                        {d.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {activeDevs.length === 0 && (
                      <span className="text-[11px] text-muted-foreground">No check-ins today</span>
                    )}
                  </div>
                  {todoCount > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {todoCount} planned · {doneCount} done today
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
