import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

/**
 * GET  /api/invite/pending        — list invites for this team (last 30 days)
 * POST /api/invite/pending        — resend: revoke old token, issue new one for same email
 */

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id, role")
      .eq("id", user.id)
      .single()

    if (!profile?.team_id || profile.role !== "admin") {
      return NextResponse.json({ error: "admin_only" }, { status: 403 })
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: invites } = await supabase
      .from("invites")
      .select("id, email, token, created_at, expires_at, used_at")
      .eq("team_id", profile.team_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })

    return NextResponse.json({ invites: invites ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  // Resend = revoke old token, create a fresh one for the same email
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("profiles").select("team_id, role").eq("id", user.id).single()
    if (!profile?.team_id || profile.role !== "admin") {
      return NextResponse.json({ error: "admin_only" }, { status: 403 })
    }

    const { token: oldToken } = await req.json().catch(() => ({}))
    if (!oldToken) return NextResponse.json({ error: "missing_token" }, { status: 400 })

    // Verify old invite belongs to this team
    const { data: oldInvite } = await supabase
      .from("invites")
      .select("email, team_id")
      .eq("token", oldToken)
      .eq("team_id", profile.team_id)
      .maybeSingle()

    if (!oldInvite) return NextResponse.json({ error: "not_found" }, { status: 404 })

    // Expire old invite
    await supabase
      .from("invites")
      .update({ expires_at: new Date(0).toISOString() })
      .eq("token", oldToken)

    // Create new invite with fresh expiry
    const { data: newInvite, error: createErr } = await supabase
      .from("invites")
      .insert({
        team_id: oldInvite.team_id,
        email: oldInvite.email,
        invited_by: user.id,
      })
      .select()
      .single()

    if (createErr || !newInvite) {
      return NextResponse.json({ error: "Failed to create new invite" }, { status: 500 })
    }

    const origin = new URL(req.url).origin
    const joinLink = `${origin}/join/${newInvite.token}`

    let emailSent = false
    if (oldInvite.email) {
      try {
        const serviceClient = createServiceClient()
        const redirectTo = `${origin}/join/${newInvite.token}`
        const inviteData = { invite_token: newInvite.token }

        console.log("[resend] attempting inviteUserByEmail for", oldInvite.email)
        const { error: inviteErr } = await serviceClient.auth.admin.inviteUserByEmail(
          oldInvite.email, { redirectTo, data: inviteData }
        )

        if (!inviteErr) {
          console.log("[resend] email sent successfully")
          emailSent = true
        } else {
          console.log("[resend] inviteUserByEmail error:", inviteErr.message)
          if (inviteErr.message.toLowerCase().includes("already")) {
            console.log("[resend] detected existing user, fetching user list...")
            const { data: usersData, error: listErr } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
            console.log("[resend] listUsers result: count=", usersData?.users?.length, "listErr=", listErr?.message)
            const ghost = usersData?.users.find(u => u.email === oldInvite.email)
            console.log("[resend] ghost found:", ghost ? `id=${ghost.id} confirmed=${ghost.email_confirmed_at}` : "none")

            if (ghost && !ghost.email_confirmed_at) {
              console.log("[resend] deleting ghost user", ghost.id)
              const { error: delErr } = await serviceClient.auth.admin.deleteUser(ghost.id)
              console.log("[resend] ghost delete result:", delErr?.message ?? "ok")
              const { error: retryErr } = await serviceClient.auth.admin.inviteUserByEmail(
                oldInvite.email, { redirectTo, data: inviteData }
              )
              console.log("[resend] retry invite result:", retryErr?.message ?? "ok")
              if (!retryErr) emailSent = true
              else console.warn("[resend] retry failed:", retryErr.message)
            } else if (ghost && ghost.email_confirmed_at) {
              console.log("[resend] ghost is a confirmed user — cannot delete and re-invite")
            } else {
              console.log("[resend] no ghost found despite 'already registered' error")
            }
          } else {
            console.warn("[resend] email send failed:", inviteErr.message)
          }
        }
      } catch (e) {
        console.warn("[resend] email error:", e)
      }
    }

    return NextResponse.json({
      token: newInvite.token,
      link: joinLink,
      emailSent,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
