import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

/**
 * POST /api/invite/set-password
 * Body: { token, password }
 *
 * Used when a user arrives via a manually-shared invite link (no Supabase #hash).
 * Supabase's inviteUserByEmail already created their auth account with no password.
 * This endpoint sets their password server-side using the admin API.
 *
 * Safety check: only sets password when email_confirmed_at is null
 * (meaning the user has never logged in — they are a brand-new invite account).
 * If the user already has a confirmed account we return { existing: true } so the
 * client can prompt them to sign in with their existing password instead.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { token, password } = body

    if (!token || !password || password.length < 6) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Validate the invite token
    const { data: invite } = await serviceClient
      .from("invites")
      .select("email, used_at, expires_at")
      .eq("token", token)
      .maybeSingle()

    if (!invite) return NextResponse.json({ error: "invalid_token" }, { status: 404 })
    if (invite.used_at) return NextResponse.json({ error: "already_used" }, { status: 410 })
    if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "expired" }, { status: 410 })
    if (!invite.email) {
      // Generic link — no email tied to invite, can't set password
      return NextResponse.json({ error: "no_email" }, { status: 400 })
    }

    // Find the auth user by email.
    // For small teams one page of 1000 is always sufficient.
    const { data: usersData, error: listErr } = await serviceClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (listErr) {
      console.error("[set-password] listUsers error:", listErr.message)
      return NextResponse.json({ error: "lookup_failed" }, { status: 500 })
    }

    const foundUser = usersData.users.find(u => u.email === invite.email)

    if (!foundUser) {
      // No auth user found — signUp will work client-side, no action needed here
      return NextResponse.json({ notFound: true })
    }

    // If user already has a confirmed account, do NOT override their password.
    // Return a flag so the client switches to "sign in" mode.
    if (foundUser.email_confirmed_at) {
      return NextResponse.json({ existing: true })
    }

    // Safe to set password: this user was created by inviteUserByEmail and has
    // never confirmed their email or set a password.
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      foundUser.id,
      { password, email_confirm: true }
    )

    if (updateError) {
      console.error("[set-password] updateUserById error:", updateError.message)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[set-password] unexpected error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
