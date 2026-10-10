import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      if (next === "/auth/reset-password") {
        return NextResponse.redirect(`${origin}/auth/reset-password?error=link_invalid`)
      }
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    if (next !== "/dashboard") {
      return NextResponse.redirect(`${origin}${next}`)
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id, name")
        .eq("id", user.id)
        .single()

      if (!profile?.team_id || profile.name === user.email?.split("@")[0]) {
        return NextResponse.redirect(`${origin}/onboarding`)
      }
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
