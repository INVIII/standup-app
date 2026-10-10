export function BoardTabSkeleton({ rows = 8, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-24 bg-card border border-border rounded" />
        <div className="h-7 w-20 bg-card border border-border rounded" />
        <div className="h-7 w-16 bg-card border border-border rounded" />
        <div className="ml-auto h-7 w-28 bg-card border border-border rounded" />
      </div>
      {/* Table header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-card border border-border rounded"
            style={{ width: i === 0 ? "40%" : `${Math.floor(60 / (columns - 1))}%` }}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2.5 bg-card border border-border rounded-[6px]"
          style={{ opacity: 1 - i * 0.07 }}
        >
          <div className="w-3 h-3 rounded-full bg-secondary shrink-0" />
          <div className="h-3 flex-1 bg-secondary rounded" style={{ maxWidth: `${60 + Math.random() * 30}%` }} />
          <div className="h-3 w-14 bg-secondary rounded shrink-0" />
          <div className="h-3 w-16 bg-secondary rounded shrink-0" />
          <div className="h-5 w-16 bg-secondary rounded shrink-0" />
        </div>
      ))}
    </div>
  )
}

export default function BoardTabSkeletonPage() {
  return <BoardTabSkeleton />
}
