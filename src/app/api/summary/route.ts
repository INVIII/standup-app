import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { streamAISummary, generateAIInsights, type ProjectContext, type MemberContext } from "@/lib/ai"
import { todayISO } from "@/lib/utils"

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const date = url.searchParams.get("date") ?? todayISO()

    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", user.id).single()
    if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })

    const { data: summary } = await supabase
      .from("daily_summaries")
      .select("*")
      .eq("team_id", profile.team_id)
      .eq("summary_date", date)
      .maybeSingle()

    return NextResponse.json(summary ?? null)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const serviceSupabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const date = url.searchParams.get("date") ?? todayISO()

  const { data: profile } = await supabase.from("profiles").select("team_id, role").eq("id", user.id).single()
  if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })
  if (profile.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 })

  const teamId = profile.team_id

  const [
    { data: checkins },
    { data: eods },
    { data: projects },
    { data: milestones },
    { data: pastSummaryRows },
    { data: recentQARows },
    { data: leaveRows },
    { data: members },
  ] = await Promise.all([
    supabase.from("checkins").select("*, profiles(name)").eq("team_id", teamId).eq("checkin_date", date),
    supabase.from("eod_updates").select("*, profiles(name)").eq("team_id", teamId).eq("eod_date", date),
    supabase.from("projects").select("*").eq("team_id", teamId).eq("is_active", true).neq("status", "done"),
    supabase.from("milestones").select("*").eq("team_id", teamId),
    // Last 3 past summaries for continuity
    serviceSupabase
      .from("daily_summaries")
      .select("summary_date, summary_text")
      .eq("team_id", teamId)
      .neq("summary_date", date)
      .order("summary_date", { ascending: false })
      .limit(3),
    // Recent Q&A from past 7 days
    serviceSupabase
      .from("summary_qa")
      .select("summary_date, question, answer")
      .eq("team_id", teamId)
      .neq("summary_date", date)
      .order("created_at", { ascending: false })
      .limit(10),
    // Leaves for this date
    supabase.from("leaves").select("*, profiles(name)").eq("team_id", teamId).eq("leave_date", date),
    // All active members
    supabase.from("profiles").select("id, name").eq("team_id", teamId).eq("is_active", true),
  ])

  if (!checkins?.length && !leaveRows?.length) {
    return NextResponse.json({ message: "no_data_for_date" }, { status: 200 })
  }

  type CheckinRow = {
    profiles: { name: string }
    todos: string
    blockers?: string
    project_id?: string
    user_id: string
    availability?: string
  }
  type EODRow = { profiles: { name: string }; accomplished: string; status: string; pending?: string; user_id: string }
  type LeaveRow = { profiles: { name: string } | null; profile_id: string; leave_type: string }
  type MemberRow = { id: string; name: string }

  const leaveMap = new Map<string, LeaveRow>()
  for (const l of leaveRows ?? []) {
    leaveMap.set(l.profile_id, l as LeaveRow)
  }

  const memberContext: MemberContext[] = (members ?? [] as MemberRow[]).map((m) => {
    const leave = leaveMap.get(m.id)
    if (leave) {
      return { name: m.name, availability: "leave", onLeave: true, leaveType: leave.leave_type }
    }
    const checkin = (checkins as CheckinRow[]).find((c) => c.user_id === m.id)
    return {
      name: m.name,
      availability: checkin?.availability ?? "working",
      onLeave: false,
    }
  })

  const morningData = (checkins as CheckinRow[])
    .map((c) => {
      const avail = c.availability && c.availability !== "working" ? ` [${c.availability.replace("_", " ")}]` : ""
      return `${c.profiles?.name}${avail}: ${c.todos}${c.blockers ? ` [BLOCKER: ${c.blockers}]` : ""}`
    })
    .join("\n")

  const eodData = eods?.length
    ? (eods as EODRow[])
        .map((e) => `${e.profiles?.name} (${e.status}): ${e.accomplished}${e.pending ? ` [PENDING: ${e.pending}]` : ""}`)
        .join("\n")
    : "No EOD updates submitted yet."

  const projectContexts: ProjectContext[] = (projects ?? []).map((p) => {
    const pMilestones = (milestones ?? []).filter((m) => m.project_id === p.id)
    const pCheckins = (checkins as CheckinRow[]).filter((c) => c.project_id === p.id)
    const daysLeft = p.end_date
      ? Math.ceil((new Date(p.end_date).getTime() - Date.now()) / 86400000)
      : null
    return {
      name: p.name,
      status: p.status,
      priority: p.priority,
      daysLeft,
      totalMilestones: pMilestones.length,
      doneMilestones: pMilestones.filter((m) => m.is_done).length,
      activeDevs: pCheckins.map((c) => c.profiles?.name).filter(Boolean),
    }
  })

  const pastSummaries = (pastSummaryRows ?? []).map(
    (r) => `[${r.summary_date}]: ${r.summary_text}`
  )

  const recentQA = (recentQARows ?? []).map(
    (r) => `[${r.summary_date}] Q: ${r.question} → A: ${r.answer}`
  )

  const encoder = new TextEncoder()
  function send(obj: object) {
    return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
  }

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const groqStream = await streamAISummary(
          morningData,
          eodData,
          projectContexts,
          pastSummaries,
          recentQA,
          memberContext
        )

        let fullText = ""
        for await (const chunk of groqStream) {
          const text = chunk.choices[0]?.delta?.content ?? ""
          if (text) {
            fullText += text
            controller.enqueue(send({ type: "chunk", text }))
          }
        }

        // Upsert summary
        await serviceSupabase
          .from("daily_summaries")
          .delete()
          .eq("team_id", teamId)
          .eq("summary_date", date)

        const { data: saved, error } = await serviceSupabase
          .from("daily_summaries")
          .insert({
            team_id: teamId,
            summary_date: date,
            summary_text: fullText,
            generated_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) throw error

        controller.enqueue(send({ type: "saved", summary: saved }))

        // Generate insights (non-fatal)
        try {
          const insights = await generateAIInsights(morningData, eodData, projectContexts, memberContext)
          await serviceSupabase.from("daily_summaries").update({ insights }).eq("id", saved.id)
          controller.enqueue(send({ type: "insights", insights }))
        } catch {
          controller.enqueue(send({ type: "insights", insights: [] }))
        }

        controller.enqueue(send({ type: "done" }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : JSON.stringify(err)
        controller.enqueue(send({ type: "error", message: msg }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  })
}
