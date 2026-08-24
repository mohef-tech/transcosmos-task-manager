"use client";

import { useEffect, useRef, useState, DragEvent } from "react";
import { tasks, attachments, Attachment, Task } from "@/app/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return "🖼";
  if (mime === "application/pdf") return "📄";
  if (mime.includes("word")) return "📝";
  if (mime.includes("excel") || mime.includes("sheet")) return "📊";
  if (mime.includes("zip")) return "🗜";
  return "📎";
}

// ─── Drop Zone ───────────────────────────────────────────────────────────────

function DropZone({
  onFiles,
  uploading,
}: {
  onFiles: (files: File[]) => void;
  uploading: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  return (
    <div
      style={{
        ...dz.zone,
        ...(dragging ? dz.zoneActive : {}),
        ...(uploading ? dz.zoneDisabled : {}),
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <span style={dz.icon}>{uploading ? "⏳" : "📁"}</span>
      <span style={dz.label}>
        {uploading
          ? "Uploading…"
          : dragging
          ? "Drop files here"
          : "Drag & drop files or click to browse"}
      </span>
      <span style={dz.hint}>Max 10 MB · jpg, png, pdf, doc, xls, zip</span>
    </div>
  );
}

const dz: Record<string, React.CSSProperties> = {
  zone: {
    border: "1.5px dashed var(--border)",
    borderRadius: "7px",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.375rem",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    background: "#fafaf9",
    userSelect: "none",
  },
  zoneActive: {
    borderColor: "var(--accent)",
    background: "#eff6ff",
  },
  zoneDisabled: {
    opacity: 0.6,
    cursor: "default",
  },
  icon: { fontSize: "1.25rem" },
  label: { fontSize: "0.8125rem", fontWeight: 500, color: "var(--text)" },
  hint: { fontSize: "0.75rem", color: "var(--text-muted)" },
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function AttachmentModal({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const [list, setList] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    tasks
      .get(task.id)
      .then((res) => setList(res.data.attachments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [task.id]);

  async function handleFiles(files: File[]) {
    setUploading(true);
    setErrors([]);
    const newErrors: string[] = [];

    for (const file of files) {
      try {
        const att = await attachments.upload(task.id, file);
        setList((prev) => [att, ...prev]);
      } catch (err) {
        newErrors.push(
          `${file.name}: ${err instanceof Error ? err.message : "Upload failed"}`
        );
      }
    }

    setErrors(newErrors);
    setUploading(false);
  }

  async function handleDelete(att: Attachment) {
    setDeletingId(att.id);
    try {
      await attachments.delete(task.id, att.id);
      setList((prev) => prev.filter((a) => a.id !== att.id));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h2 style={s.title}>Attachments</h2>
            <p style={s.subtitle}>{task.title}</p>
          </div>
          <button onClick={onClose} style={s.closeBtn} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={s.body}>
          <DropZone onFiles={handleFiles} uploading={uploading} />

          {errors.length > 0 && (
            <div style={s.errorBox}>
              {errors.map((e, i) => (
                <p key={i} style={s.errorLine}>{e}</p>
              ))}
            </div>
          )}

          {/* File list */}
          {loading ? (
            <p style={s.empty}>Loading…</p>
          ) : list.length === 0 ? (
            <p style={s.empty}>No attachments yet.</p>
          ) : (
            <ul style={s.list}>
              {list.map((att) => (
                <li key={att.id} style={s.item}>
                  {/* Thumbnail or icon */}
                  <div style={s.thumb}>
                    {att.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={att.thumbnail_url}
                        alt={att.file_name}
                        style={s.thumbImg}
                      />
                    ) : (
                      <span style={s.thumbIcon}>{fileIcon(att.mime_type)}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={s.info}>
                    <span style={s.fileName}>{att.file_name}</span>
                    <span style={s.fileMeta}>{formatBytes(att.file_size)}</span>
                  </div>

                  {/* Actions */}
                  <div style={s.actions}>
                    <a
                      href={`${attachments.downloadUrl(att.task_id, att.id)}?token=${localStorage.getItem("token") ?? ""}`}
                      style={s.btnDown}
                      title="Download"
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        // Use fetch with auth header for download
                        e.preventDefault();
                        const token = localStorage.getItem("token") ?? "";
                        fetch(attachments.downloadUrl(att.task_id, att.id), {
                          headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
                        })
                          .then((r) => r.blob())
                          .then((blob) => {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = att.file_name;
                            a.click();
                            URL.revokeObjectURL(url);
                          });
                      }}
                    >
                      ↓
                    </a>
                    <button
                      onClick={() => handleDelete(att)}
                      disabled={deletingId === att.id}
                      style={s.btnDel}
                      title="Delete"
                    >
                      {deletingId === att.id ? "…" : "✕"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: "1rem",
  },
  modal: {
    background: "var(--surface)",
    borderRadius: "8px",
    width: "100%",
    maxWidth: "520px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
    display: "flex",
    flexDirection: "column",
    maxHeight: "80vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "1rem 1.25rem",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  title: {
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: "var(--text)",
  },
  subtitle: {
    fontSize: "0.8125rem",
    color: "var(--text-muted)",
    marginTop: "2px",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    fontSize: "0.875rem",
    padding: "0.25rem",
    cursor: "pointer",
  },
  body: {
    padding: "1.25rem",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "0.875rem",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "5px",
    padding: "0.625rem 0.75rem",
  },
  errorLine: {
    fontSize: "0.8125rem",
    color: "var(--danger)",
  },
  empty: {
    fontSize: "0.875rem",
    color: "var(--text-muted)",
    textAlign: "center",
    padding: "1rem 0",
  },
  list: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "1px",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.625rem 0.5rem",
    borderRadius: "5px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
  },
  thumb: {
    width: "36px",
    height: "36px",
    borderRadius: "4px",
    background: "#f5f5f4",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  thumbIcon: {
    fontSize: "1.125rem",
  },
  info: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
  },
  fileName: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileMeta: {
    fontSize: "0.75rem",
    color: "var(--text-muted)",
  },
  actions: {
    display: "flex",
    gap: "0.375rem",
    flexShrink: 0,
  },
  btnDown: {
    width: "28px",
    height: "28px",
    borderRadius: "4px",
    border: "1px solid var(--border)",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.875rem",
    color: "var(--accent)",
    cursor: "pointer",
    textDecoration: "none",
  },
  btnDel: {
    width: "28px",
    height: "28px",
    borderRadius: "4px",
    border: "1px solid var(--border)",
    background: "transparent",
    fontSize: "0.75rem",
    color: "var(--text-muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
