import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

// POST /api/invite - admin creates an invite (optionally tied to an email)
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id, role")
      .eq("id", user.id)
      .single()

    if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })
    if (profile.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const email: string | null = body.email?.trim() || null

    // Prevent duplicate: if a non-expired, non-used invite already exists for this email, return it
    if (email) {
      const { data: existing } = await supabase
        .from("invites")
        .select("token")
        .eq("team_id", profile.team_id)
        .eq("email", email)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ token: existing.token, alreadyExists: true, emailSent: false })
      }
    }

    // Create invite record
    const { data: invite, error } = await supabase
      .from("invites")
      .insert({
        team_id: profile.team_id,
        email,
        invited_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // If email provided, send a real invite email via Supabase Auth
    let emailSent = false
    if (email) {
      try {
        const serviceClient = createServiceClient()
        const origin = new URL(req.url).origin
        const redirectTo = `${origin}/join/${invite.token}`

        const { error: inviteErr } = await serviceClient.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { invite_token: invite.token },
        })

        if (!inviteErr) {
          emailSent = true
        } else if (inviteErr.message.toLowerCase().includes("already")) {
          const { data: usersData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
          const ghost = usersData?.users.find(u => u.email === email)
          if (ghost && !ghost.email_confirmed_at) {
            await serviceClient.auth.admin.deleteUser(ghost.id)
            const { error: retryErr } = await serviceClient.auth.admin.inviteUserByEmail(email, {
              redirectTo,
              data: { invite_token: invite.token },
            })
            if (!retryErr) emailSent = true
            else console.warn("[invite] retry failed:", retryErr.message)
          } else {
            console.warn("[invite] email send failed:", inviteErr.message)
          }
        } else {
          console.warn("[invite] email send failed:", inviteErr.message)
        }
      } catch (e) {
        console.warn("[invite] email error:", e)
      }
    }

    return NextResponse.json({ token: invite.token, invite, emailSent })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[invite] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET /api/invite?token=xxx - validate an invite token
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const token = new URL(req.url).searchParams.get("token")
    if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 })

    const { data: invite } = await supabase
      .from("invites")
      .select("*, teams(id, name)")
      .eq("token", token)
      .maybeSingle()

    if (!invite) return NextResponse.json({ error: "invalid_token" }, { status: 404 })
    if (invite.used_at) return NextResponse.json({ error: "already_used" }, { status: 410 })
    if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "expired" }, { status: 410 })

    return NextResponse.json({
      valid: true,
      team_id: invite.team_id,
      team_name: invite.teams?.name,
      email: invite.email,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/invite?token=xxx - admin revokes an invite
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("profiles").select("team_id, role").eq("id", user.id).single()
    if (!profile?.team_id || profile.role !== "admin") {
      return NextResponse.json({ error: "admin_only" }, { status: 403 })
    }

    const token = new URL(req.url).searchParams.get("token")
    if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 })

    // Find the invite so we can get its email
    const { data: targetInvite } = await supabase
      .from("invites")
      .select("email")
      .eq("token", token)
      .eq("team_id", profile.team_id)
      .maybeSingle()

    // Expire this token AND all other pending invites for the same email.
    // This cleans up duplicates created before the dedup check was added.
    if (targetInvite?.email) {
      await supabase
        .from("invites")
        .update({ expires_at: new Date(0).toISOString() })
        .eq("team_id", profile.team_id)
        .eq("email", targetInvite.email)
        .is("used_at", null)
    } else {
      // Generic (no-email) link — just expire this specific token
      await supabase
        .from("invites")
        .update({ expires_at: new Date(0).toISOString() })
        .eq("token", token)
        .eq("team_id", profile.team_id)
        .is("used_at", null)
    }

    return NextResponse.json({ success: true, email: targetInvite?.email ?? null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH /api/invite - mark invite as used and join team
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 })

    const { data: invite } = await supabase
      .from("invites")
      .select("*")
      .eq("token", token)
      .maybeSingle()

    if (!invite) return NextResponse.json({ error: "invalid_token" }, { status: 404 })
    if (invite.used_at) return NextResponse.json({ error: "already_used" }, { status: 410 })
    if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "expired" }, { status: 410 })

    // Join team
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ team_id: invite.team_id, role: "member" })
      .eq("id", user.id)

    if (updateError) throw updateError

    // Mark invite used
    await supabase
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token)

    return NextResponse.json({ success: true, team_id: invite.team_id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
