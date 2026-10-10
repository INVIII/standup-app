export default function BoardListLoading() {
  return (
    <div className="max-w-2xl space-y-3 animate-pulse">
      <div className="space-y-1">
        <div className="h-5 w-24 bg-card border border-border rounded" />
        <div className="h-3.5 w-48 bg-card border border-border rounded" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 bg-card border border-border rounded-lg" />
      ))}
    </div>
  )
}
