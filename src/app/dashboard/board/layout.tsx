// This layout is a passthrough - BoardShell lives in [boardId]/layout.tsx
// so it has access to the boardId param directly.
export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
