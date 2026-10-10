"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.slice(1))
      if (params.get("type") === "invite" && params.get("access_token")) {
        try {
          const payload = JSON.parse(atob(params.get("access_token")!.split(".")[1]))
          const inviteToken = payload?.user_metadata?.invite_token as string | undefined
          if (inviteToken) {
            window.location.replace(`/join/${inviteToken}${hash}`)
            return
          }
        } catch {
        }
      }
    }

    async function redirect() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      router.replace(user ? "/dashboard" : "/login")
    }
    redirect()
  }, [router])

  return null
}
