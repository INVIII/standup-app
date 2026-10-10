import { cn } from "@/lib/utils"
import type { EODStatus } from "@/types/database"

interface StatusBadgeProps {
  status: EODStatus | "sod" | "none"
  className?: string
}

const config = {
  sod:     { dot: "#5e6ad2", label: "Checked in" },
  done:    { dot: "#26d97f", label: "Productive" },
  partial: { dot: "#f5a524", label: "Partial" },
  blocked: { dot: "#f54260", label: "Blocked" },
  none:    { dot: "#3a3a3a", label: "Not submitted" },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { dot, label } = config[status] ?? config.none
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
      {label}
    </span>
  )
}

export function StatusDot({ status }: { status: EODStatus | "sod" | "none" }) {
  const { dot } = config[status] ?? config.none
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: dot }}
      title={config[status]?.label}
    />
  )
}
