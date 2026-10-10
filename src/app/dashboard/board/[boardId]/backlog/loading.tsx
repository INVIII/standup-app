import { BoardTabSkeleton } from "@/components/board/BoardTabSkeleton"

export default function BacklogLoading() {
  return <BoardTabSkeleton rows={10} columns={5} />
}
