import { redirect } from "next/navigation"
import type { Profile } from "@/types/database"

export function RoleGuard({
  profile,
  role,
  children,
}: {
  profile: Profile | null
  role: "admin" | "member"
  children: React.ReactNode
}) {
  if (!profile) redirect("/login")
  if (role === "admin" && profile.role !== "admin") redirect("/dashboard")
  return <>{children}</>
}
