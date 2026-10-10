"use client"

import { createContext, useContext, useState } from "react"

type Ctx = { open: boolean; toggle: () => void; close: () => void }

const MobileSidebarCtx = createContext<Ctx>({ open: false, toggle: () => {}, close: () => {} })

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <MobileSidebarCtx.Provider value={{ open, toggle: () => setOpen(o => !o), close: () => setOpen(false) }}>
      {children}
    </MobileSidebarCtx.Provider>
  )
}

export const useMobileSidebar = () => useContext(MobileSidebarCtx)
