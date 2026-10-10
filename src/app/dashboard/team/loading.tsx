export default function TeamLoading() {
  return (
    <div className="max-w-3xl space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-5 w-20 bg-card border border-border rounded" />
          <div className="h-3.5 w-40 bg-card border border-border rounded" />
        </div>
        <div className="h-8 w-28 bg-card border border-border rounded" />
      </div>
      {/* Groups */}
      {[1, 2].map((group) => (
        <div key={group} className="space-y-2">
          <div className="h-4 w-24 bg-card border border-border rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-card border border-border rounded-[6px]" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      ))}
    </div>
  )
}
