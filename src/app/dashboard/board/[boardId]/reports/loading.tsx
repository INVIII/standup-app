export default function ReportsLoading() {
  return (
    <div className="space-y-4 animate-pulse max-w-5xl">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-card border border-border rounded-lg" />
        ))}
      </div>
      {/* Chart placeholders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-56 bg-card border border-border rounded-lg" />
        <div className="h-56 bg-card border border-border rounded-lg" />
      </div>
      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="h-10 border-b border-border" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-11 border-b border-border/40 last:border-0" />
        ))}
      </div>
    </div>
  )
}
