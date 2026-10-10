"use client"

import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import { useEffect } from "react"
import { cn } from "@/lib/utils"

/**
 * Convert a stored description into editor-ready HTML.
 * Existing descriptions may be plain text (with newlines) — wrap those into
 * paragraphs so they render correctly. Anything that already looks like HTML
 * is passed through unchanged.
 */
function toHTML(value: string): string {
  if (!value) return ""
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(value)
  if (looksLikeHtml) return value
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return value
    .split(/\n{2,}/)
    .map(block => `<p>${escape(block).replace(/\n/g, "<br>")}</p>`)
    .join("")
}

const baseExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Link.configure({ openOnClick: true, autolink: true, HTMLAttributes: { class: "text-primary underline", rel: "noopener noreferrer", target: "_blank" } }),
  Image.configure({ HTMLAttributes: { class: "rounded-md max-w-full my-2" } }),
]

// ── Read-only renderer ──────────────────────────────────────────────
export function RichTextContent({ html, className }: { html: string; className?: string }) {
  const editor = useEditor({
    editable: false,
    immediatelyRender: false,
    extensions: baseExtensions,
    content: toHTML(html),
  })

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setContent(toHTML(html))
  }, [html, editor])

  return <EditorContent editor={editor} className={cn("tiptap-content text-[13px]", className)} />
}

// ── Editable editor with toolbar ────────────────────────────────────
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  autoFocus,
  minHeight = 120,
  onImageUpload,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  autoFocus?: boolean
  minHeight?: number
  // Upload an image and return its URL (or null). Used for paste + toolbar.
  onImageUpload?: (file: File) => Promise<string | null>
}) {
  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      ...baseExtensions,
      Placeholder.configure({ placeholder: placeholder ?? "Add a description…" }),
    ],
    content: toHTML(value),
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "outline-none px-3 py-2.5",
        style: `min-height:${minHeight}px`,
      },
      handlePaste(view, event) {
        if (!onImageUpload) return false
        const items = Array.from(event.clipboardData?.items ?? [])
        const img = items.find(it => it.type.startsWith("image/"))
        if (!img) return false
        const file = img.getAsFile()
        if (!file) return false
        event.preventDefault()
        onImageUpload(file).then(url => {
          if (url && editor) editor.chain().focus().setImage({ src: url }).run()
        })
        return true
      },
    },
  })

  if (!editor) return null

  return (
    // stopPropagation: keep clicks inside the editor from reaching any parent
    // "click outside to close" listeners (e.g. the issue detail panel).
    <div
      className="border border-border rounded-md bg-secondary/40 focus-within:ring-1 focus-within:ring-primary"
      onMouseDown={e => e.stopPropagation()}
    >
      <Toolbar editor={editor} onImageUpload={onImageUpload} />
      <EditorContent editor={editor} className="tiptap-content" />
    </div>
  )
}

// ── Toolbar ─────────────────────────────────────────────────────────
// Stable, module-level button — defining it inside Toolbar would remount it on
// every editor update and detach the clicked node mid-event.
function Btn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onClick() }}
      className={cn(
        "w-7 h-7 flex items-center justify-center rounded transition-colors",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      )}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor, onImageUpload }: { editor: Editor; onImageUpload?: (file: File) => Promise<string | null> }) {
  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Link URL", prev ?? "https://")
    if (url === null) return
    if (url === "") { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  async function pickImage() {
    if (!onImageUpload) return
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const url = await onImageUpload(file)
      if (url) editor.chain().focus().setImage({ src: url }).run()
    }
    input.click()
  }

  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b border-border px-1.5 py-1">
      <Btn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold text-[12px]">B</span>
      </Btn>
      <Btn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic text-[12px]">I</span>
      </Btn>
      <Btn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through text-[12px]">S</span>
      </Btn>
      <Btn title="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <span className="font-mono text-[11px]">{"<>"}</span>
      </Btn>
      <span className="w-px h-4 bg-border mx-0.5" />
      <Btn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <span className="font-semibold text-[12px]">H1</span>
      </Btn>
      <Btn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <span className="font-semibold text-[12px]">H2</span>
      </Btn>
      <span className="w-px h-4 bg-border mx-0.5" />
      <Btn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="4" r="1" fill="currentColor"/><circle cx="3" cy="8" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      </Btn>
      <Btn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><text x="0.5" y="5.5" fontSize="5" fill="currentColor">1</text><text x="0.5" y="9.5" fontSize="5" fill="currentColor">2</text><text x="0.5" y="13.5" fontSize="5" fill="currentColor">3</text></svg>
      </Btn>
      <Btn title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <span className="text-[14px] leading-none">&ldquo;</span>
      </Btn>
      <span className="w-px h-4 bg-border mx-0.5" />
      <Btn title="Link" active={editor.isActive("link")} onClick={setLink}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6.5 9.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5L7.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M9.5 6.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
      </Btn>
      {onImageUpload && (
        <Btn title="Image" onClick={pickImage}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="5.5" cy="6" r="1.2" fill="currentColor"/><path d="M2 11l3.5-3 3 2.5L11 7l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Btn>
      )}
    </div>
  )
}
