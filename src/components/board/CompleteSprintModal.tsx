"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { Sprint } from "@/types/database"

interface Props {
  sprint: Sprint
  incompleteCount: number
  otherSprints: Sprint[]          
  loading: boolean
  onConfirm: (incompleteToSprintId: string | null) => void
  onCancel: () => void
}

export function CompleteSprintModal({
  sprint, incompleteCount, otherSprints, loading, onConfirm, onCancel,
}: Props) {
  const [destination, setDestination] = useState<string>("backlog")

  function handleConfirm() {
    onConfirm(destination === "backlog" ? null : destination)
  }

  return (
    /* backdrop */
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm">
      <div
        className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M7.5 1.5L13.5 12.5H1.5L7.5 1.5Z"
                  stroke="#f59e0b" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M7.5 6v3M7.5 10.5v.5"
                  stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className="text-[14px] font-semibold">Complete sprint?</h2>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                <span className="font-medium text-foreground">{sprint.name}</span> has{" "}
                <span className="font-medium text-foreground">
                  {incompleteCount} incomplete {incompleteCount === 1 ? "issue" : "issues"}
                </span>
                . Where should they go?
              </p>
            </div>
          </div>
        </div>

        {/* destination picker */}
        <div className="px-5 py-4 space-y-2">
          {/* backlog option */}
          <label
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
              destination === "backlog"
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:border-border/80 hover:bg-secondary/50"
            }`}
          >
            <input
              type="radio"
              name="destination"
              value="backlog"
              checked={destination === "backlog"}
              onChange={() => setDestination("backlog")}
              className="accent-primary"
            />
            <div>
              <p className="text-[13px] font-medium">Move to Backlog</p>
              <p className="text-[11px] text-muted-foreground">Incomplete issues go back to the backlog</p>
            </div>
          </label>

          {/* other sprints */}
          {otherSprints.map(s => (
            <label
              key={s.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                destination === s.id
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:border-border/80 hover:bg-secondary/50"
              }`}
            >
              <input
                type="radio"
                name="destination"
                value={s.id}
                checked={destination === s.id}
                onChange={() => setDestination(s.id)}
                className="accent-primary"
              />
              <div>
                <p className="text-[13px] font-medium">{s.name}</p>
                <p className="text-[11px] text-muted-foreground capitalize">
                  {s.status === "active" ? "Active sprint" : "Planning"}
                </p>
              </div>
            </label>
          ))}
        </div>

        {/* footer */}
        <div className="px-5 pb-5 flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            className="text-[13px]"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-[13px] min-w-[130px]"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                Completing…
              </span>
            ) : "Complete sprint →"}
          </Button>
        </div>
      </div>
    </div>
  )
}
