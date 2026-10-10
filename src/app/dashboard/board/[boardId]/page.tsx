import { redirect } from "next/navigation"

export default async function BoardIdIndexPage({
  params,
}: {
  params: Promise<{ boardId: string }>
}) {
  const { boardId } = await params
  redirect(`/dashboard/board/${boardId}/backlog`)
}
