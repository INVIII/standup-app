export default function CalendarLoading() {
  return (
    <div className="space-y-3 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-7 w-8 bg-card border border-border rounded" />
        <div className="h-5 w-32 bg-card border border-border rounded" />
        <div className="h-7 w-8 bg-card border border-border rounded" />
        <div className="ml-auto h-7 w-20 bg-card border border-border rounded" />
      </div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <div key={d} className="h-8 bg-card border border-border rounded text-center" />
        ))}
      </div>
      {/* Calendar cells - 5 weeks */}
      {[1, 2, 3, 4, 5].map((week) => (
        <div key={week} className="grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <div
              key={day}
              className="h-20 bg-card border border-border rounded-[6px]"
              style={{ opacity: 1 - week * 0.1 }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
