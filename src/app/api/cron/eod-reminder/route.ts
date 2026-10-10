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

  const { data: checkedIn } = await supabase
    .from("checkins")
    .select("user_id, profiles(name, email)")
    .eq("checkin_date", today)

  const { data: eodDone } = await supabase
    .from("eod_updates")
    .select("user_id")
    .eq("eod_date", today)

  const eodDoneIds = new Set((eodDone ?? []).map((e) => e.user_id))
  const pending = (checkedIn ?? []).filter(
    (c) => !eodDoneIds.has(c.user_id)
  ) as unknown as Array<{ user_id: string; profiles: { name: string; email: string } | null }>

  for (const item of pending) {
    if (!item.profiles) continue
    console.log(`[REMINDER] EOD reminder → ${item.profiles.email} (${item.profiles.name})`)
    // TODO: await sendEODReminder(item.profiles.email, item.profiles.name)
  }

  return NextResponse.json({ sent: pending.length, skipped: eodDoneIds.size })
}
