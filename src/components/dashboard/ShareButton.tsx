"use client"

import { useState } from "react"
import { toast } from "sonner"

export function ShareButton({
  summaryId,
  existingToken,
}: {
  summaryId: string
  existingToken?: string | null
}) {
  const [token, setToken] = useState(existingToken ?? null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function share() {
    if (token) {
      const url = `${window.location.origin}/s/${token}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/summary/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to share")
      setToken(data.token)
      const url = `${window.location.origin}/s/${data.token}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("Share link copied to clipboard")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to share")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={share}
      disabled={loading}
      className="flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium text-muted-foreground border border-border rounded-[5px] hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
      title="Share summary"
    >
      {loading ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" strokeDasharray="7 7" />
        </svg>
      ) : copied ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#26d97f" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="9.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="2.5" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="9.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4 6.75 8 9M4 5.25 8 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
      {copied ? "Copied!" : "Share"}
    </button>
  )
}
