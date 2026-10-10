"use client"

import { useRouter } from "next/navigation"

export function DateNav({ date, today }: { date: string; today: string }) {
  const router = useRouter()
  const isToday = date === today

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => {
          if (e.target.value) {
            router.push(e.target.value === today
              ? "/dashboard/summary"
              : `/dashboard/summary?date=${e.target.value}`)
          }
        }}
        className="h-7 px-2 text-[12px] bg-secondary border border-border rounded-[5px] text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40 dark:[color-scheme:dark]"
      />
      {!isToday && (
        <button
          onClick={() => router.push("/dashboard/summary")}
          className="text-[11px] text-primary hover:underline whitespace-nowrap"
        >
          Today
        </button>
      )}
    </div>
  )
}
