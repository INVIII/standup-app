export default function TimelineLoading() {
  return (
    <div className="space-y-3 animate-pulse">
      {/* Header controls */}
      <div className="flex items-center gap-2">
        <div className="h-7 w-8 bg-card border border-border rounded" />
        <div className="h-5 w-28 bg-card border border-border rounded" />
        <div className="h-7 w-8 bg-card border border-border rounded" />
        <div className="ml-auto h-7 w-24 bg-card border border-border rounded" />
      </div>
      {/* Month header */}
      <div className="h-8 bg-card border border-border rounded" />
      {/* Epic / sprint bars */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3.5 w-28 bg-card border border-border rounded shrink-0" />
          <div
            className="h-6 bg-secondary rounded"
            style={{ width: `${20 + (i * 17) % 50}%`, marginLeft: `${(i * 13) % 25}%` }}
          />
        </div>
      ))}
    </div>
  )
}
