export default function Loading() {
  return (
    <div className="max-w-3xl space-y-5">
      <div className="space-y-1">
        <div className="h-5 w-24 bg-card border border-border rounded animate-pulse" />
        <div className="h-4 w-48 bg-card border border-border rounded animate-pulse" />
      </div>
      {[1,2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-20 bg-card border border-border rounded animate-pulse" />
          <div className="h-16 bg-card border border-border rounded-lg animate-pulse" />
          <div className="h-16 bg-card border border-border rounded-lg animate-pulse" />
        </div>
      ))}
    </div>
  )
}
