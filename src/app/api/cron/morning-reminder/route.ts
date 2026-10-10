import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { todayISO } from "@/lib/utils"

export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = todayISO()

  const { data: allMembers } = await supabase
    .from("profiles")
    .select("id, name, email, team_id")
    .eq("is_active", true)

  const { data: submittedToday } = await supabase
    .from("checkins")
    .select("user_id")
    .eq("checkin_date", today)

  const submittedIds = new Set((submittedToday ?? []).map((c) => c.user_id))
  const pending = (allMembers ?? []).filter((m) => !submittedIds.has(m.id))

  // In V1: log only - add Resend here when ready
  for (const member of pending) {
    console.log(`[REMINDER] Morning reminder → ${member.email} (${member.name})`)
    // TODO: await sendMorningReminder(member.email, member.name)
  }

  return NextResponse.json({ sent: pending.length, skipped: submittedIds.size })
}
