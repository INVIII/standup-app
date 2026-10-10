"use client"

import { useState } from "react"
import { toast } from "sonner"
import { cn, getInitials } from "@/lib/utils"
import type { DocFolder, DocLink } from "@/types/database"

type Props = {
  initialFolders: DocFolder[]
  initialLinks: DocLink[]
  isAdmin: boolean
  currentUserId: string
}

export function DocumentationClient({ initialFolders, initialLinks, isAdmin, currentUserId }: Props) {
  const [folders, setFolders] = useState<DocFolder[]>(initialFolders)
  const [links, setLinks] = useState<DocLink[]>(initialLinks)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [addingRoot, setAddingRoot] = useState(false)
  const [rootName, setRootName] = useState("")
  const [linkModal, setLinkModal] = useState<{ folderId: string | null; link?: DocLink } | null>(null)

  const canManage = (createdBy: string | null) => isAdmin || createdBy === currentUserId
  const rootFolders = folders.filter(f => !f.parent_id)
  const rootLinks = links.filter(l => !l.folder_id)

  function setFolderCollapsed(id: string, value: boolean) {
    setCollapsed(c => ({ ...c, [id]: value }))
  }

  // ── Folder ops ──────────────────────────────────────────────────────
  async function createFolder(name: string, parentId: string | null) {
    const res = await fetch("/api/docs/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: parentId }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? "Failed to create folder"); return }
    setFolders(prev => [...prev, data])
    if (parentId) setCollapsed(c => ({ ...c, [parentId]: false }))
    toast.success("Folder created")
  }

  async function renameFolder(id: string, name: string) {
    const res = await fetch("/api/docs/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error === "not_allowed" ? "Only the owner or an admin can rename this" : data.error ?? "Failed"); return }
    setFolders(prev => prev.map(f => f.id === id ? data : f))
  }

  function deleteFolder(folder: DocFolder) {
    // Collect descendant folder ids (for cascade in local state)
    const descendants = new Set<string>([folder.id])
    let added = true
    while (added) {
      added = false
      for (const f of folders) {
        if (f.parent_id && descendants.has(f.parent_id) && !descendants.has(f.id)) {
          descendants.add(f.id); added = true
        }
      }
    }
    const linkCount = links.filter(l => l.folder_id && descendants.has(l.folder_id)).length
    const subCount = descendants.size - 1
    toast.warning(`Delete "${folder.name}"?`, {
      description: `This also deletes ${subCount} subfolder${subCount !== 1 ? "s" : ""} and ${linkCount} link${linkCount !== 1 ? "s" : ""} inside it.`,
      duration: 8000,
      action: {
        label: "Delete",
        onClick: async () => {
          const res = await fetch(`/api/docs/folders?id=${folder.id}`, { method: "DELETE" })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) { toast.error(data.error === "not_allowed" ? "Only the owner or an admin can delete this" : data.error ?? "Failed"); return }
          setFolders(prev => prev.filter(f => !descendants.has(f.id)))
          setLinks(prev => prev.filter(l => !l.folder_id || !descendants.has(l.folder_id)))
          toast.success("Folder deleted")
        },
      },
    })
  }

  // ── Link ops ────────────────────────────────────────────────────────
  async function saveLink(payload: { title: string; url: string; description: string }) {
    if (!linkModal) return
    const editing = linkModal.link
    const res = await fetch("/api/docs/links", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editing
          ? { id: editing.id, ...payload }
          : { ...payload, folder_id: linkModal.folderId }
      ),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? "Failed to save link"); return }
    if (editing) setLinks(prev => prev.map(l => l.id === data.id ? data : l))
    else setLinks(prev => [...prev, data])
    setLinkModal(null)
    toast.success(editing ? "Link updated" : "Link added")
  }

  async function deleteLink(link: DocLink) {
    const res = await fetch(`/api/docs/links?id=${link.id}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error === "not_allowed" ? "Only the owner or an admin can delete this" : data.error ?? "Failed"); return }
    setLinks(prev => prev.filter(l => l.id !== link.id))
    toast.success("Link deleted")
  }

  const isEmpty = rootFolders.length === 0 && rootLinks.length === 0

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-semibold">Documentation</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Shared links, guides and references for your team
          </p>
        </div>
        {!addingRoot && (
          <button
            onClick={() => { setAddingRoot(true); setRootName("") }}
            className="text-[12px] px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <PlusIcon /> New folder
          </button>
        )}
      </div>

      {/* New root folder inline input */}
      {addingRoot && (
        <form
          onSubmit={e => { e.preventDefault(); if (rootName.trim()) { createFolder(rootName.trim(), null); setAddingRoot(false); setRootName("") } }}
          className="flex items-center gap-2 mb-4 p-2 rounded-lg border border-border bg-secondary/30"
        >
          <FolderIcon />
          <input
            autoFocus value={rootName} onChange={e => setRootName(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") { setAddingRoot(false); setRootName("") } }}
            placeholder="Folder name…"
            className="flex-1 h-7 px-2 text-[13px] bg-background border border-border rounded outline-none focus:ring-1 focus:ring-primary"
          />
          <button type="submit" disabled={!rootName.trim()} className="h-7 px-2.5 text-[11px] bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">Create</button>
          <button type="button" onClick={() => { setAddingRoot(false); setRootName("") }} className="h-7 px-2 text-[11px] border border-border rounded hover:bg-secondary">Cancel</button>
        </form>
      )}

      {isEmpty && !addingRoot && (
        <div className="border border-dashed border-border rounded-lg py-12 text-center">
          <p className="text-[13px] text-muted-foreground">No documentation yet</p>
          <p className="text-[12px] text-muted-foreground/60 mt-1">Create a folder to get started.</p>
        </div>
      )}

      {/* Root-level links (no folder) */}
      {rootLinks.length > 0 && (
        <div className="space-y-2 mb-4">
          {rootLinks.map(link => (
            <LinkCard key={link.id} link={link} canManage={canManage(link.created_by)}
              onEdit={() => setLinkModal({ folderId: null, link })} onDelete={() => deleteLink(link)} />
          ))}
        </div>
      )}

      {/* Folder tree */}
      <div className="space-y-2">
        {rootFolders.map(folder => (
          <FolderNode
            key={folder.id}
            folder={folder}
            depth={0}
            folders={folders}
            links={links}
            collapsed={collapsed}
            onToggle={setFolderCollapsed}
            canManage={canManage}
            onAddSubfolder={(parentId, name) => createFolder(name, parentId)}
            onRename={renameFolder}
            onDelete={deleteFolder}
            onAddLink={folderId => setLinkModal({ folderId })}
            onEditLink={link => setLinkModal({ folderId: link.folder_id, link })}
            onDeleteLink={deleteLink}
          />
        ))}
      </div>

      {linkModal && (
        <LinkModal
          link={linkModal.link}
          onCancel={() => setLinkModal(null)}
          onSave={saveLink}
        />
      )}
    </div>
  )
}

/* ── FolderNode (recursive, module-level to avoid remount churn) ── */

function FolderNode({
  folder, depth, folders, links, collapsed, onToggle, canManage,
  onAddSubfolder, onRename, onDelete, onAddLink, onEditLink, onDeleteLink,
}: {
  folder: DocFolder
  depth: number
  folders: DocFolder[]
  links: DocLink[]
  collapsed: Record<string, boolean>
  onToggle: (id: string, value: boolean) => void
  canManage: (createdBy: string | null) => boolean
  onAddSubfolder: (parentId: string, name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (folder: DocFolder) => void
  onAddLink: (folderId: string) => void
  onEditLink: (link: DocLink) => void
  onDeleteLink: (link: DocLink) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(folder.name)
  const [addingSub, setAddingSub] = useState(false)
  const [subName, setSubName] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)

  const children = folders.filter(f => f.parent_id === folder.id)
  const folderLinks = links.filter(l => l.folder_id === folder.id)
  const isCollapsed = collapsed[folder.id] ?? depth > 0
  const mine = canManage(folder.created_by)

  return (
    <div className="border border-border rounded-lg bg-card" style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      {/* Folder header */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 bg-card hover:bg-secondary/30 transition-colors",
        isCollapsed ? "rounded-lg" : "rounded-t-lg"
      )}>
        <button onClick={() => onToggle(folder.id, !isCollapsed)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={cn("transition-transform", isCollapsed && "-rotate-90")}>
            <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <FolderIcon />
        {renaming ? (
          <form onSubmit={e => { e.preventDefault(); if (nameDraft.trim()) { onRename(folder.id, nameDraft.trim()); setRenaming(false) } }} className="flex items-center gap-1.5 flex-1">
            <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") { setRenaming(false); setNameDraft(folder.name) } }}
              className="flex-1 h-7 px-2 text-[13px] bg-background border border-border rounded outline-none focus:ring-1 focus:ring-primary" />
            <button type="submit" className="h-7 px-2 text-[11px] bg-primary text-primary-foreground rounded">Save</button>
            <button type="button" onClick={() => { setRenaming(false); setNameDraft(folder.name) }} className="h-7 px-2 text-[11px] border border-border rounded">Cancel</button>
          </form>
        ) : (
          <span className="text-[13px] font-semibold flex-1">{folder.name}</span>
        )}

        {!renaming && (
          <>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {folderLinks.length} link{folderLinks.length !== 1 ? "s" : ""}
            </span>
            <button onClick={() => { setAddingSub(true); if (isCollapsed) onToggle(folder.id, false) }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 flex items-center gap-1">
              <PlusIcon /> Subfolder
            </button>
            <button onClick={() => onAddLink(folder.id)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 flex items-center gap-1">
              <PlusIcon /> Add link
            </button>
            {mine && (
              <div className="relative shrink-0">
                <button onClick={() => setMenuOpen(o => !o)} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3.5" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="8" cy="12.5" r="1.2" /></svg>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl py-1 z-20 min-w-[140px]">
                      <button onClick={() => { setRenaming(true); setNameDraft(folder.name); setMenuOpen(false) }} className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary transition-colors">Rename</button>
                      <button onClick={() => { setMenuOpen(false); onDelete(folder) }} className="w-full text-left px-3 py-1.5 text-[12px] text-destructive hover:bg-secondary transition-colors">Delete</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {!isCollapsed && (
        <div className="px-3 py-2 space-y-2 border-t border-border/60 rounded-b-lg">
          {/* Add subfolder inline */}
          {addingSub && (
            <form onSubmit={e => { e.preventDefault(); if (subName.trim()) { onAddSubfolder(folder.id, subName.trim()); setSubName(""); setAddingSub(false) } }}
              className="flex items-center gap-2 p-2 rounded-md border border-border bg-secondary/30">
              <FolderIcon />
              <input autoFocus value={subName} onChange={e => setSubName(e.target.value)}
                onKeyDown={e => { if (e.key === "Escape") { setAddingSub(false); setSubName("") } }}
                placeholder="Subfolder name…"
                className="flex-1 h-7 px-2 text-[12px] bg-background border border-border rounded outline-none focus:ring-1 focus:ring-primary" />
              <button type="submit" disabled={!subName.trim()} className="h-7 px-2.5 text-[11px] bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">Create</button>
              <button type="button" onClick={() => { setAddingSub(false); setSubName("") }} className="h-7 px-2 text-[11px] border border-border rounded">Cancel</button>
            </form>
          )}

          {/* Links in this folder */}
          {folderLinks.map(link => (
            <LinkCard key={link.id} link={link} canManage={canManage(link.created_by)}
              onEdit={() => onEditLink(link)} onDelete={() => onDeleteLink(link)} />
          ))}

          {/* Subfolders */}
          {children.map(child => (
            <FolderNode
              key={child.id} folder={child} depth={depth + 1}
              folders={folders} links={links} collapsed={collapsed} onToggle={onToggle} canManage={canManage}
              onAddSubfolder={onAddSubfolder} onRename={onRename} onDelete={onDelete}
              onAddLink={onAddLink} onEditLink={onEditLink} onDeleteLink={onDeleteLink}
            />
          ))}

          {folderLinks.length === 0 && children.length === 0 && !addingSub && (
            <p className="text-[12px] text-muted-foreground/50 italic px-1 py-1">Empty folder</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ── LinkCard ── */

function LinkCard({ link, canManage, onEdit, onDelete }: {
  link: DocLink; canManage: boolean; onEdit: () => void; onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  let host = ""
  try { host = new URL(link.url).hostname.replace(/^www\./, "") } catch { host = link.url }
  const owner = link.creator

  return (
    <div className="relative flex items-center gap-3 p-2.5 rounded-md border border-border bg-secondary/40 hover:bg-secondary/70 transition-colors group">
      {confirming && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-1.5 bg-background/95 backdrop-blur-sm rounded-md border border-destructive/40">
          <span className="text-[11px] text-muted-foreground mr-0.5">Delete this link?</span>
          <button onClick={onDelete} className="text-[11px] px-2 py-0.5 rounded bg-destructive text-white hover:bg-destructive/90">Delete</button>
          <button onClick={() => setConfirming(false)} className="text-[11px] px-2 py-0.5 rounded border border-border hover:bg-secondary">Cancel</button>
        </div>
      )}

      <div className="w-7 h-7 rounded bg-card border border-border flex items-center justify-center shrink-0">
        <LinkIcon />
      </div>

      <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate hover:text-primary transition-colors">{link.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {host}{link.description ? ` · ${link.description}` : ""}
        </p>
      </a>

      {owner && (
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
          style={{ backgroundColor: owner.avatar_color ?? "#5e6ad2" }} title={`Added by ${owner.name}`}>
          {getInitials(owner.name)}
        </div>
      )}

      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <a href={link.url} target="_blank" rel="noopener noreferrer" title="Open link"
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
          <OpenIcon />
        </a>
        {canManage && (
          <>
            <button onClick={onEdit} title="Edit"
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
              <EditIcon />
            </button>
            <button onClick={() => setConfirming(true)} title="Delete"
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <TrashIcon />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ── LinkModal (add / edit) ── */

function LinkModal({ link, onCancel, onSave }: {
  link?: DocLink
  onCancel: () => void
  onSave: (payload: { title: string; url: string; description: string }) => void
}) {
  const [title, setTitle] = useState(link?.title ?? "")
  const [url, setUrl] = useState(link?.url ?? "")
  const [description, setDescription] = useState(link?.description ?? "")
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !url.trim()) return
    setSaving(true)
    await onSave({ title: title.trim(), url: url.trim(), description: description.trim() })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm" onClick={onCancel}>
      <form onSubmit={submit} className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <h2 className="text-[14px] font-semibold">{link ? "Edit link" : "Add documentation link"}</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Title</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="API Design Guidelines"
              className="w-full h-9 px-3 text-[13px] bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…"
              className="w-full h-9 px-3 text-[13px] bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Description <span className="text-muted-foreground/50 normal-case">(optional)</span></label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short note about this doc"
              className="w-full h-9 px-3 text-[13px] bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="text-[13px] px-3 py-1.5 border border-border rounded-md hover:bg-secondary transition-colors">Cancel</button>
          <button type="submit" disabled={!title.trim() || !url.trim() || saving}
            className="text-[13px] px-4 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : link ? "Save changes" : "Add link"}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ── Icons ── */
const PlusIcon = () => (<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>)
const FolderIcon = () => (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0 text-muted-foreground"><path d="M1.5 4a1 1 0 011-1h3l1.5 1.5h5a1 1 0 011 1V12a1 1 0 01-1 1h-9a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>)
const LinkIcon = () => (<svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-muted-foreground"><path d="M6.5 9.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5L7.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M9.5 6.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>)
const OpenIcon = () => (<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M10 2h4v4M14 2l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>)
const EditIcon = () => (<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3L5 14H2v-3L11 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>)
const TrashIcon = () => (<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>)
