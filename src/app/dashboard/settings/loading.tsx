export default function Loading() {
  return (
    <div className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <div className="h-5 w-24 bg-card border border-border rounded animate-pulse" />
        <div className="h-4 w-56 bg-card border border-border rounded animate-pulse" />
      </div>
      <div className="h-48 bg-card border border-border rounded-lg animate-pulse" />
      <div className="h-32 bg-card border border-border rounded-lg animate-pulse" />
      <div className="h-24 bg-card border border-border rounded-lg animate-pulse" />
    </div>
  )
}
