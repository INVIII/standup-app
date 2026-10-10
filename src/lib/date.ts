/**
 * All date/time utilities - IST (Asia/Kolkata, UTC+5:30) throughout.
 * Never use new Date().toISOString() for display or "today" checks - it returns UTC.
 */

const IST = "Asia/Kolkata"

/** Today's date in IST as "YYYY-MM-DD" */
export function todayIST(): string {
  // en-CA locale formats as YYYY-MM-DD natively
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date())
}

/** Current hour (0–23) in IST — use instead of new Date().getHours() on the server. */
export function hourIST(d: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: IST, hour: "2-digit", hour12: false }).format(d)
  ) % 24
}

/**
 * Convert a Date object to a local-timezone "YYYY-MM-DD" string.
 * Use this instead of d.toISOString().split("T")[0] to avoid UTC shift.
 */
export function toLocalISO(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(d)
}

/**
 * Format a date string or Date for display in IST.
 * For date-only strings (no time component), appends T12:00:00 before parsing
 * so the date is never shifted to the previous day by UTC conversion.
 * Default: "Apr 27"
 */
export function fmtDate(
  d: string | Date,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  const date =
    typeof d === "string"
      ? new Date(d.includes("T") || d.includes("Z") ? d : d + "T12:00:00")
      : d
  return date.toLocaleDateString("en-US", { ...opts, timeZone: IST })
}

/** "Apr 27, 2026" */
export function fmtDateLong(d: string | Date): string {
  return fmtDate(d, { month: "short", day: "numeric", year: "numeric" })
}

/** "Monday, April 27, 2026" - for TopBar / page headings */
export function fmtDateFull(d: Date = new Date()): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: IST,
  })
}

// ── IST range helpers (for AI board-chat & analytics) ───────────────────────

/** Add (or subtract) whole days to an IST "YYYY-MM-DD" string, staying in IST. */
export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00+05:30`)
  d.setUTCDate(d.getUTCDate() + days)
  return toLocalISO(d)
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/** IST weekday (0=Sun…6=Sat) for an IST date string. */
function weekdayIST(dateStr: string): number {
  const wd = new Date(`${dateStr}T12:00:00+05:30`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: IST,
  })
  return WEEKDAY_INDEX[wd] ?? 0
}

/** Monday-based start of the week containing dateStr (IST). */
export function startOfWeekIST(dateStr: string = todayIST()): string {
  const diff = (weekdayIST(dateStr) + 6) % 7 // days since Monday
  return addDaysISO(dateStr, -diff)
}

/** First day of the month containing dateStr (IST). */
export function startOfMonthIST(dateStr: string = todayIST()): string {
  return `${dateStr.slice(0, 8)}01`
}

/** IST start-of-day as an offset-aware instant — safe for timestamptz filters. */
export function istDayStartInstant(dateStr: string): string {
  return `${dateStr}T00:00:00+05:30`
}

/** IST end-of-day as an offset-aware instant — safe for timestamptz filters. */
export function istDayEndInstant(dateStr: string): string {
  return `${dateStr}T23:59:59.999+05:30`
}

export type TimeframeKind =
  | "today" | "yesterday" | "week" | "lastweek" | "month" | "lastmonth" | "sprint"

/**
 * Parse a free-text question into an IST date range.
 * `sprint` returns today's bounds as a placeholder — the caller resolves the
 * real sprint window from the active sprint's start/end dates.
 */
export function resolveTimeframe(text: string): {
  start: string; end: string; label: string; kind: TimeframeKind
} {
  const t = text.toLowerCase()
  const today = todayIST()

  if (/\byesterday\b/.test(t)) {
    const y = addDaysISO(today, -1)
    return { start: y, end: y, label: "yesterday", kind: "yesterday" }
  }
  if (/\blast week\b/.test(t)) {
    const start = addDaysISO(startOfWeekIST(today), -7)
    return { start, end: addDaysISO(start, 6), label: "last week", kind: "lastweek" }
  }
  if (/\b(this|current|past) week\b/.test(t) || /\bthis wk\b/.test(t)) {
    return { start: startOfWeekIST(today), end: today, label: "this week", kind: "week" }
  }
  if (/\blast month\b/.test(t)) {
    const firstThis = startOfMonthIST(today)
    const lastPrev = addDaysISO(firstThis, -1)
    return { start: startOfMonthIST(lastPrev), end: lastPrev, label: "last month", kind: "lastmonth" }
  }
  if (/\b(this|current) month\b/.test(t)) {
    return { start: startOfMonthIST(today), end: today, label: "this month", kind: "month" }
  }
  if (/\bsprint\b/.test(t)) {
    return { start: today, end: today, label: "this sprint", kind: "sprint" }
  }
  return { start: today, end: today, label: "today", kind: "today" }
}

/** "10:30 AM" */
export function fmtTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  })
}

/**
 * "Apr 27, 10:30 AM" - for comment timestamps, generated_at, etc.
 * Accepts extra options to override defaults.
 */
export function fmtDateTime(
  d: string | Date,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
    timeZone: IST,
  })
}
