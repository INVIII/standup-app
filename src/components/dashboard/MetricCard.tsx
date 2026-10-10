import { Skeleton } from "@/components/ui/skeleton"

interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

export function MetricCard({ label, value, sub, accent }: MetricCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3.5">
      <p className="text-[11px] text-muted-foreground mb-1.5">{label}</p>
      <p className={`text-[22px] font-semibold tracking-tight leading-none ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3.5">
      <Skeleton className="h-2.5 w-16 mb-2" />
      <Skeleton className="h-6 w-10" />
    </div>
  )
}
