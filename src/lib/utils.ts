import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow } from "date-fns"
import { fmtDateLong, fmtTime as fmtTimeIST, todayIST } from "@/lib/date"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return fmtDateLong(date)
}

export function formatTime(date: string | Date) {
  return fmtTimeIST(date)
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

/** @deprecated Use todayIST() from @/lib/date instead */
export function todayISO(): string {
  return todayIST()
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export const AVATAR_COLORS = [
  "#5e6ad2", "#26a69a", "#ec4899", "#f59e0b",
  "#10b981", "#6366f1", "#f43f5e", "#8b5cf6",
]

export function getAvatarColor(name: string): string {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

export function statusColor(status: "done" | "partial" | "blocked" | "sod" | "none"): string {
  const map: Record<string, string> = {
    done: "#26d97f",
    partial: "#f5a524",
    blocked: "#f54260",
    sod: "#5e6ad2",
    none: "#3a3a3a",
  }
  return map[status]
}

export function statusLabel(status: "done" | "partial" | "blocked" | "sod" | "none"): string {
  const map: Record<string, string> = {
    done: "Productive",
    partial: "Partial",
    blocked: "Blocked",
    sod: "Checked In",
    none: "Not Submitted",
  }
  return map[status]
}
