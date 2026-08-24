"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
import {
  tasks,
  Task,
  TaskPayload,
  TaskStatus,
  TaskPriority,
} from "@/app/lib/api";
import AttachmentModal from "@/app/components/AttachmentModal";
import { usePolling } from "@/app/hooks/usePolling";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const STATUS_COLOR: Record<TaskStatus, React.CSSProperties> = {
  pending: { background: "#fef9c3", color: "#854d0e" },
  in_progress: { background: "#dbeafe", color: "#1e40af" },
  completed: { background: "#dcfce7", color: "#166534" },
};

const PRIORITY_COLOR: Record<TaskPriority, React.CSSProperties> = {
  low: { background: "#f5f5f4", color: "#57534e" },
  medium: { background: "#fff7ed", color: "#9a3412" },
  high: { background: "#fef2f2", color: "#991b1b" },
};

const EMPTY_FORM: TaskPayload = {
  title: "",
  description: "",
  status: "pending",
  priority: "medium",
  due_date: "",
};

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>{title}</h2>
          <button onClick={onClose} style={s.closeBtn} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Task Form ───────────────────────────────────────────────────────────────

function TaskForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: TaskPayload;
  onSave: (data: TaskPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TaskPayload>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof TaskPayload>(key: K, value: TaskPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      {error && <p style={s.formError}>{error}</p>}

      <div style={s.field}>
        <label style={s.label}>Title *</label>
        <input
          style={s.input}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          required
          placeholder="Task title"
        />
      </div>

      <div style={s.field}>
        <label style={s.label}>Description</label>
        <textarea
          style={{ ...s.input, ...s.textarea }}
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Optional description"
          rows={3}
        />
      </div>

      <div style={s.row}>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Status</label>
          <select
            style={s.input}
            value={form.status}
            onChange={(e) => set("status", e.target.value as TaskStatus)}
          >
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((v) => (
              <option key={v} value={v}>
                {STATUS_LABEL[v]}
              </option>
            ))}
          </select>
        </div>

        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Priority</label>
          <select
            style={s.input}
            value={form.priority}
            onChange={(e) => set("priority", e.target.value as TaskPriority)}
          >
            {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((v) => (
              <option key={v} value={v}>
                {PRIORITY_LABEL[v]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={s.field}>
        <label style={s.label}>Due Date</label>
        <input
          style={s.input}
          type="date"
          value={form.due_date ?? ""}
          onChange={(e) => set("due_date", e.target.value)}
        />
      </div>

      <div style={s.formActions}>
        <button type="button" onClick={onCancel} style={s.btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={saving} style={s.btnPrimary}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

function Badge({
  label,
  style,
}: {
  label: string;
  style: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 500,
        ...style,
      }}
    >
      {label}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  // filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  // modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [attachTask, setAttachTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [live, setLive] = useState(false); // flicker saat polling refresh

  async function loadTasks(p = page) {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, per_page: 10 };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;

      const res = await tasks.list(params);
      setTaskList(res.data);
      setLastPage(res.meta.last_page);
      setTotal(res.meta.total);
    } catch {
      // silent — layout handles auth errors
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterStatus, filterPriority]);

  // search with debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      loadTasks(1);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Polling — silent background refresh setiap 10 detik
  const silentRefresh = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page, per_page: 10 };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      const res = await tasks.list(params);
      setTaskList(res.data);
      setLastPage(res.meta.last_page);
      setTotal(res.meta.total);
      // Flicker indikator "Live"
      setLive(true);
      setTimeout(() => setLive(false), 800);
    } catch {
      // silent
    }
  }, [page, search, filterStatus, filterPriority]);

  usePolling({ onTick: silentRefresh, intervalMs: 10_000 });

  async function handleCreate(data: TaskPayload) {
    await tasks.create(data);
    setShowCreate(false);
    loadTasks(1);
    setPage(1);
  }

  async function handleEdit(data: Partial<TaskPayload>) {
    if (!editTask) return;
    await tasks.update(editTask.id, data);
    setEditTask(null);
    loadTasks(page);
  }

  async function handleDelete() {
    if (!deleteTask) return;
    setDeleting(true);
    try {
      await tasks.delete(deleteTask.id);
      setDeleteTask(null);
      loadTasks(page);
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div>
      {/* Header */}
      <div style={s.pageHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div>
            <h1 style={s.pageTitle}>Tasks</h1>
            <p style={s.pageCount}>{total} total</p>
          </div>
          <span
            style={{
              ...s.liveDot,
              ...(live ? s.liveDotActive : {}),
            }}
            title="Auto-refreshing every 10s"
          />
        </div>
        <button onClick={() => setShowCreate(true)} style={s.btnPrimary}>
          + New Task
        </button>
      </div>

      {/* Filters */}
      <div style={s.filters}>
        <input
          style={{ ...s.input, ...s.searchInput }}
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          style={{ ...s.input, ...s.filterSelect }}
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
        >
          <option value="">All status</option>
          {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((v) => (
            <option key={v} value={v}>{STATUS_LABEL[v]}</option>
          ))}
        </select>

        <select
          style={{ ...s.input, ...s.filterSelect }}
          value={filterPriority}
          onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }}
        >
          <option value="">All priority</option>
          {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((v) => (
            <option key={v} value={v}>{PRIORITY_LABEL[v]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Title</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Priority</th>
              <th style={s.th}>Due</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={s.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : taskList.length === 0 ? (
              <tr>
                <td colSpan={5} style={s.emptyCell}>
                  No tasks found.
                </td>
              </tr>
            ) : (
              taskList.map((task) => (
                <tr key={task.id} style={s.tr}>
                  <td style={s.td}>
                    <span style={s.taskTitle}>{task.title}</span>
                    {task.description && (
                      <span style={s.taskDesc}>{task.description}</span>
                    )}
                  </td>
                  <td style={s.td}>
                    <Badge
                      label={STATUS_LABEL[task.status]}
                      style={STATUS_COLOR[task.status]}
                    />
                  </td>
                  <td style={s.td}>
                    <Badge
                      label={PRIORITY_LABEL[task.priority]}
                      style={PRIORITY_COLOR[task.priority]}
                    />
                  </td>
                  <td style={{ ...s.td, color: "var(--text-muted)" }}>
                    {formatDate(task.due_date)}
                  </td>
                  <td style={{ ...s.td, ...s.actionCell }}>
                    <button
                      onClick={() => setEditTask(task)}
                      style={s.btnAction}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setAttachTask(task)}
                      style={s.btnAction}
                    >
                      Files
                    </button>
                    <button
                      onClick={() => setDeleteTask(task)}
                      style={{ ...s.btnAction, color: "var(--danger)" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div style={s.pagination}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={s.pageBtn}
          >
            ← Prev
          </button>
          <span style={s.pageInfo}>
            Page {page} / {lastPage}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page === lastPage}
            style={s.pageBtn}
          >
            Next →
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="New Task" onClose={() => setShowCreate(false)}>
          <TaskForm
            initial={EMPTY_FORM}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {editTask && (
        <Modal title="Edit Task" onClose={() => setEditTask(null)}>
          <TaskForm
            initial={{
              title: editTask.title,
              description: editTask.description ?? "",
              status: editTask.status,
              priority: editTask.priority,
              due_date: editTask.due_date ?? "",
            }}
            onSave={handleEdit}
            onCancel={() => setEditTask(null)}
          />
        </Modal>
      )}

      {/* Attachment Modal */}
      {attachTask && (
        <AttachmentModal
          task={attachTask}
          onClose={() => setAttachTask(null)}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTask && (
        <Modal title="Delete Task" onClose={() => setDeleteTask(null)}>
          <div style={s.deleteBody}>
            <p style={s.deleteText}>
              Delete <strong>"{deleteTask.title}"</strong>? This cannot be undone.
            </p>
            <div style={s.formActions}>
              <button
                onClick={() => setDeleteTask(null)}
                style={s.btnSecondary}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ ...s.btnPrimary, background: "var(--danger)" }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.25rem",
  },
  pageTitle: {
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "var(--text)",
  },
  pageCount: {
    fontSize: "0.8125rem",
    color: "var(--text-muted)",
    marginTop: "2px",
  },
  liveDot: {
    display: "inline-block",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#d1fae5",
    border: "1.5px solid #6ee7b7",
    marginTop: "4px",
    transition: "background 0.3s, border-color 0.3s",
    flexShrink: 0,
  },
  liveDotActive: {
    background: "var(--success)",
    borderColor: "var(--success)",
  },

  filters: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1rem",
  },
  searchInput: {
    flex: 1,
    maxWidth: "280px",
  },
  filterSelect: {
    width: "140px",
  },

  tableWrap: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "0.625rem 1rem",
    textAlign: "left",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid var(--border)",
    background: "#fafaf9",
  },
  tr: {
    borderBottom: "1px solid var(--border)",
  },
  td: {
    padding: "0.75rem 1rem",
    fontSize: "0.875rem",
    verticalAlign: "middle",
  },
  taskTitle: {
    display: "block",
    fontWeight: 500,
    color: "var(--text)",
  },
  taskDesc: {
    display: "block",
    fontSize: "0.8125rem",
    color: "var(--text-muted)",
    marginTop: "2px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "280px",
  },
  actionCell: {
    display: "flex",
    gap: "0.5rem",
    justifyContent: "flex-end",
  },
  btnAction: {
    background: "transparent",
    border: "none",
    fontSize: "0.8125rem",
    color: "var(--accent)",
    padding: "0.25rem 0.375rem",
    borderRadius: "4px",
  },
  emptyCell: {
    padding: "2.5rem",
    textAlign: "center",
    color: "var(--text-muted)",
    fontSize: "0.875rem",
  },

  pagination: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginTop: "1rem",
  },
  pageBtn: {
    padding: "0.4375rem 0.75rem",
    border: "1px solid var(--border)",
    borderRadius: "5px",
    background: "var(--surface)",
    fontSize: "0.8125rem",
    color: "var(--text)",
    cursor: "pointer",
  },
  pageInfo: {
    fontSize: "0.8125rem",
    color: "var(--text-muted)",
  },

  // Modal
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
    maxWidth: "480px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 1.25rem",
    borderBottom: "1px solid var(--border)",
  },
  modalTitle: {
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: "var(--text)",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    fontSize: "0.875rem",
    lineHeight: 1,
    padding: "0.25rem",
  },

  // Form
  form: {
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.875rem",
  },
  formError: {
    background: "#fef2f2",
    color: "var(--danger)",
    border: "1px solid #fecaca",
    borderRadius: "5px",
    padding: "0.5rem 0.75rem",
    fontSize: "0.8125rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
  },
  label: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "var(--text)",
  },
  input: {
    padding: "0.5rem 0.625rem",
    border: "1px solid var(--border)",
    borderRadius: "5px",
    fontSize: "0.875rem",
    color: "var(--text)",
    background: "var(--surface)",
    outline: "none",
    width: "100%",
  },
  textarea: {
    resize: "vertical",
    minHeight: "70px",
  },
  row: {
    display: "flex",
    gap: "0.75rem",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.5rem",
    marginTop: "0.25rem",
  },
  btnPrimary: {
    padding: "0.5rem 1rem",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "0.5rem 1rem",
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
    borderRadius: "5px",
    fontSize: "0.875rem",
    cursor: "pointer",
  },

  // Delete modal
  deleteBody: {
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  deleteText: {
    fontSize: "0.875rem",
    color: "var(--text)",
    lineHeight: 1.6,
  },
};
