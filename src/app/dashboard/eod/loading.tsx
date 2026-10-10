export default function Loading() {
  return (
    <div className="max-w-2xl space-y-3">
      <div className="space-y-1">
        <div className="h-5 w-32 bg-card border border-border rounded animate-pulse" />
        <div className="h-4 w-48 bg-card border border-border rounded animate-pulse" />
      </div>
      <div className="h-56 bg-card border border-border rounded-lg animate-pulse" />
    </div>
  )
}
