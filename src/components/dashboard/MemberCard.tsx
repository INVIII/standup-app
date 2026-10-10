import { getInitials } from "@/lib/utils"
import { StatusBadge } from "./StatusBadge"
import type { MemberStatus } from "@/types/database"

export function MemberCard({ member }: { member: MemberStatus }) {
  const { profile, checkin, eod } = member

  const status = eod
    ? (eod.status as "done" | "partial" | "blocked")
    : checkin
    ? "sod"
    : "none"

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
            style={{ backgroundColor: profile.avatar_color ?? "#5e6ad2" }}
          >
            {getInitials(profile.name)}
          </div>
          <div>
            <p className="text-[13px] font-medium leading-tight">{profile.name}</p>
            <StatusBadge status={status} />
          </div>
        </div>
      </div>

      {checkin && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Planned</p>
          <ul className="space-y-1">
            {checkin.todos.split("\n").filter(Boolean).slice(0, 3).map((todo, i) => (
              <li key={i} className="text-[12px] text-foreground flex items-start gap-2">
                <span className="mt-[5px] w-1 h-1 rounded-full bg-muted-foreground/60 shrink-0" />
                <span className="leading-snug">{todo.trim()}</span>
              </li>
            ))}
          </ul>
          {checkin.blockers && (
            <p className="text-[11px] text-[#f5a524] mt-2 flex items-start gap-1.5">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0 mt-0.5">
                <path d="M6 1L11 10H1L6 1Z" stroke="#f5a524" strokeWidth="1" strokeLinejoin="round" />
                <path d="M6 5v2M6 8.5v.5" stroke="#f5a524" strokeWidth="1" strokeLinecap="round" />
              </svg>
              {checkin.blockers}
            </p>
          )}
        </div>
      )}

      {eod && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Accomplished</p>
          <p className="text-[12px] text-foreground/90 leading-relaxed line-clamp-3">{eod.accomplished}</p>
        </div>
      )}

      {!checkin && (
        <p className="text-[12px] text-muted-foreground italic">No check-in submitted today.</p>
      )}
    </div>
  )
}
