"use client"

import { useState, useRef, useLayoutEffect, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

/**
 * Portal-based dropdown that escapes ALL overflow-hidden / scroll ancestors.
 * Positions itself with fixed coordinates relative to the trigger, and flips
 * upward automatically when there isn't enough room below the viewport.
 */
export function Dropdown({
  button,
  buttonClassName,
  buttonStyle,
  buttonTitle,
  children,
  align = "right",
  width = 160,
  menuClassName,
}: {
  button: React.ReactNode
  buttonClassName?: string
  buttonStyle?: React.CSSProperties
  buttonTitle?: string
  // children receives a `close` fn to dismiss the menu after an action
  children: (close: () => void) => React.ReactNode
  align?: "left" | "right"
  width?: number
  menuClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; placement: "down" | "up" } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const recompute = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const placement: "down" | "up" = spaceBelow < 240 && r.top > 240 ? "up" : "down"
    const rawLeft = align === "right" ? r.right - width : r.left
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - width - 8))
    const top = placement === "down" ? r.bottom + 4 : r.top - 4
    setCoords({ top, left, placement })
  }, [align, width])

  useLayoutEffect(() => { if (open) recompute() }, [open, recompute])

  useEffect(() => {
    if (!open) return
    const onMove = () => recompute()
    window.addEventListener("scroll", onMove, true)
    window.addEventListener("resize", onMove)
    return () => {
      window.removeEventListener("scroll", onMove, true)
      window.removeEventListener("resize", onMove)
    }
  }, [open, recompute])

  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={buttonTitle}
        className={buttonClassName}
        style={buttonStyle}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
      >
        {button}
      </button>

      {mounted && open && coords && createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div
            className={cn("fixed z-[100] bg-popover border border-border rounded-lg shadow-xl py-1 max-h-[60vh] overflow-y-auto", menuClassName)}
            style={{
              top: coords.top,
              left: coords.left,
              width,
              transform: coords.placement === "up" ? "translateY(-100%)" : undefined,
            }}
            onClick={e => e.stopPropagation()}
          >
            {children(close)}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
