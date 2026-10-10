export default function Loading() {
  return (
    <div className="max-w-3xl space-y-5">
      <div className="space-y-1">
        <div className="h-5 w-24 bg-card border border-border rounded animate-pulse" />
        <div className="h-4 w-48 bg-card border border-border rounded animate-pulse" />
      </div>
      <div className="h-40 bg-card border border-border rounded-lg animate-pulse" />
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="h-9 border-b border-border animate-pulse bg-secondary/40" />
        {[1,2,3].map((i) => <div key={i} className="h-14 border-b border-border last:border-0 animate-pulse" />)}
      </div>
    </div>
  )
}
