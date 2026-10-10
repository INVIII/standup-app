export default function SummaryLoading() {
  return (
    <div className="space-y-4 animate-pulse max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-5 w-36 bg-card border border-border rounded" />
          <div className="h-3.5 w-52 bg-card border border-border rounded" />
        </div>
        <div className="h-8 w-32 bg-card border border-border rounded" />
      </div>
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-card border border-border rounded-lg" />
        ))}
      </div>
      {/* AI summary card */}
      <div className="h-36 bg-card border border-border rounded-lg" />
      {/* Activity rows */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="h-10 border-b border-border" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 border-b border-border/40 last:border-0" />
        ))}
      </div>
    </div>
  )
}
