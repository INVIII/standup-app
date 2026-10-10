import type { IssueType, IssuePriority } from "@/types/database"

/* ── Issue type SVG icons (Jira-style) ───────────────────────────── */

export function IssueTypeIcon({ type, size = 14 }: { type: IssueType | string; size?: number }) {
  switch (type) {
    case "epic":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#8b5cf6" fillOpacity="0.2" />
          <path d="M8.5 3.5L5.5 8.5H8L7.5 12.5L11 7.5H8.5L9 3.5H8.5Z" fill="#8b5cf6" />
        </svg>
      )
    case "story":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#5e6ad2" fillOpacity="0.18" />
          <path d="M5 4h4.5l1.5 1.5V12H5V4Z" stroke="#5e6ad2" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M7 7.5h3M7 9.5h2" stroke="#5e6ad2" strokeWidth="1" strokeLinecap="round" />
        </svg>
      )
    case "task":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#26d97f" fillOpacity="0.15" />
          <path d="M5 8.5l2.2 2L11 6" stroke="#26d97f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case "bug":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#f54260" fillOpacity="0.15" />
          <circle cx="8" cy="8" r="2.8" stroke="#f54260" strokeWidth="1.3" />
          <path d="M8 5.2V3.5M5.2 6.2 3.5 5M10.8 6.2 12.5 5M5.2 9.8 3.5 11M10.8 9.8 12.5 11" stroke="#f54260" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      )
    case "subtask":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" stroke="#6b6b6b" strokeWidth="1.1" strokeDasharray="2.5 1.5" />
          <path d="M5.5 8.5l2 2 3-3" stroke="#6b6b6b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#6b6b6b" fillOpacity="0.15" />
          <circle cx="8" cy="8" r="2.5" stroke="#6b6b6b" strokeWidth="1.3" />
        </svg>
      )
  }
}

/* ── Priority SVG icons (Jira-style) ─────────────────────────────── */

export function PriorityIcon({ priority, size = 14 }: { priority: IssuePriority | string; size?: number }) {
  switch (priority) {
    case "urgent":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="#f54260" fillOpacity="0.12" stroke="#f54260" strokeWidth="0.8" />
          <path d="M5.5 10.5L8 5L10.5 10.5" stroke="#f54260" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 8.8h3" stroke="#f54260" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )
    case "high":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <path d="M8 2.5L13.5 13H2.5L8 2.5Z" fill="#f5a524" fillOpacity="0.12" stroke="#f5a524" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M8 7v3" stroke="#f5a524" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="0.7" fill="#f5a524" />
        </svg>
      )
    case "medium":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <circle cx="8" cy="8" r="6.5" fill="#5e6ad2" fillOpacity="0.1" stroke="#5e6ad2" strokeWidth="0.8" />
          <path d="M5.5 6.5h5M5.5 9.5h5" stroke="#5e6ad2" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )
    case "low":
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <circle cx="8" cy="8" r="6.5" fill="#26d97f" fillOpacity="0.08" stroke="#26d97f" strokeWidth="0.8" />
          <path d="M5.5 6L8 10L10.5 6" stroke="#26d97f" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default: // no_priority
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0">
          <circle cx="8" cy="8" r="6.5" stroke="#6b6b6b" strokeWidth="0.9" strokeDasharray="2.5 2" />
          <path d="M5.5 8h5" stroke="#6b6b6b" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )
  }
}

export function PriorityLabel({ priority }: { priority: IssuePriority | string }) {
  return <span style={{ color: PRIORITY_CONFIG[priority as IssuePriority]?.color ?? "#6b6b6b" }}>{PRIORITY_CONFIG[priority as IssuePriority]?.label ?? priority}</span>
}

/* ── Config maps (kept for compatibility) ───────────────────────── */

export const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  epic:    { color: "#8b5cf6", label: "Epic"    },
  story:   { color: "#5e6ad2", label: "Story"   },
  task:    { color: "#26d97f", label: "Task"    },
  bug:     { color: "#f54260", label: "Bug"     },
  subtask: { color: "#6b6b6b", label: "Subtask" },
}

export const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  urgent:      { color: "#f54260", label: "Urgent"      },
  high:        { color: "#f5a524", label: "High"        },
  medium:      { color: "#5e6ad2", label: "Medium"      },
  low:         { color: "#26d97f", label: "Low"         },
  no_priority: { color: "#6b6b6b", label: "No priority" },
}
