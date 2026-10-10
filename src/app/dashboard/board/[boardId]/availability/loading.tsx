export default function AvailabilityLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Out today banner placeholder */}
      <div className="h-10 bg-amber-500/8 border border-amber-500/20 rounded-lg" />

      {/* Calendar grid */}
      <div className="flex gap-3 overflow-x-auto">
        {/* Names column */}
        <div className="shrink-0 w-[148px]">
          <div className="h-4 w-14 bg-card border border-border rounded mb-1.5 opacity-0" />
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <div className="h-[52px] border-b border-border" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 flex items-center gap-2 px-3 border-b border-border/40 last:border-0">
                <div className="w-5 h-5 rounded-full bg-secondary shrink-0" />
                <div className="h-3 flex-1 bg-secondary rounded" />
              </div>
            ))}
          </div>
        </div>
        {/* Week grids */}
        {["This week", "Next week"].map((label) => (
          <div key={label} className="flex-1 min-w-[320px]">
            <div className="h-4 w-16 bg-card border border-border rounded mb-1.5" />
            <div className="rounded-lg border border-border overflow-hidden bg-card">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-border">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <div key={d} className="py-2 flex flex-col items-center gap-1 border-r border-border last:border-r-0">
                    <div className="h-2.5 w-6 bg-secondary rounded" />
                    <div className="h-4 w-5 bg-secondary rounded" />
                    <div className="h-2 w-5 bg-secondary/50 rounded" />
                  </div>
                ))}
              </div>
              {/* Member rows */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="grid grid-cols-7 h-9 border-b border-border/40 last:border-0">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <div key={d} className="border-r border-border/20 last:border-r-0" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-40 bg-card border border-border rounded-lg" />
        <div className="h-40 bg-card border border-border rounded-lg" />
      </div>
    </div>
  )
}
