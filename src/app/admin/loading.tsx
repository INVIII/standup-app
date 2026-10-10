export default function Loading() {
  return (
    <div className="max-w-4xl space-y-5">
      <div className="space-y-1">
        <div className="h-5 w-24 bg-card border border-border rounded animate-pulse" />
        <div className="h-4 w-48 bg-card border border-border rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[1,2,3,4].map((i) => <div key={i} className="h-16 bg-card border border-border rounded-lg animate-pulse" />)}
      </div>
      <div className="h-48 bg-card border border-border rounded-lg animate-pulse" />
    </div>
  )
}
