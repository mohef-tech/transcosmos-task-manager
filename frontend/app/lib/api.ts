const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string): void {
  localStorage.setItem("token", token);
}

export function removeToken(): void {
  localStorage.removeItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
}

export const auth = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: AuthUser }>("/auth/me"),

  logout: () =>
    request<void>("/auth/logout", { method: "POST" }),
};

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high";

// ─── Attachments ─────────────────────────────────────────────────────────────

export interface Attachment {
  id: number;
  task_id: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  url: string;
  thumbnail_url: string | null;
  uploaded_at: string;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  attachments?: Attachment[];
}

export interface TasksResponse {
  data: Task[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface TaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  assigned_to?: number | null;
}

export const tasks = {
  list: (params?: Record<string, string | number>) => {
    const qs = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    return request<TasksResponse>(`/tasks${qs}`);
  },

  get: (id: number) => request<{ data: Task & { attachments: Attachment[] } }>(`/tasks/${id}`),

  create: (payload: TaskPayload) =>
    request<{ data: Task }>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: number, payload: Partial<TaskPayload>) =>
    request<{ data: Task }>(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  delete: (id: number) =>
    request<void>(`/tasks/${id}`, { method: "DELETE" }),
};

// ─── Attachment API ───────────────────────────────────────────────────────────

export const attachments = {
  /** Upload file (multipart/form-data) — returns formatted attachment */
  upload: (taskId: number, file: File): Promise<Attachment> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const form = new FormData();
    form.append("file", file);

    return fetch(`${BASE_URL}/tasks/${taskId}/attachments`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    })
      .then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(new Error(e.message ?? "Upload failed")));
        return res.json() as Promise<Attachment>;
      });
  },

  delete: (taskId: number, attachmentId: number) =>
    request<void>(`/tasks/${taskId}/attachments/${attachmentId}`, {
      method: "DELETE",
    }),

  downloadUrl: (taskId: number, attachmentId: number) =>
    `${BASE_URL}/tasks/${taskId}/attachments/${attachmentId}/download`,
};
