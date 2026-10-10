export default function BoardLoading() {
  // Kanban column skeletons
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 animate-pulse">
      {[1, 2, 3, 4].map((col) => (
        <div key={col} className="shrink-0 w-[260px] space-y-2">
          {/* Column header */}
          <div className="flex items-center gap-2 px-1 py-1.5">
            <div className="w-2 h-2 rounded-full bg-secondary" />
            <div className="h-3.5 w-20 bg-card border border-border rounded" />
            <div className="h-4 w-5 bg-secondary rounded ml-auto" />
          </div>
          {/* Cards */}
          {Array.from({ length: 3 + col }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-[6px] p-3 space-y-2"
              style={{ opacity: 1 - i * 0.1 }}
            >
              <div className="h-3 bg-secondary rounded w-4/5" />
              <div className="h-3 bg-secondary rounded w-3/5" />
              <div className="flex items-center gap-2 pt-1">
                <div className="h-4 w-12 bg-secondary rounded" />
                <div className="h-5 w-5 rounded-full bg-secondary ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
