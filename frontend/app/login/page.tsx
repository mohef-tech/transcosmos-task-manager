"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { auth, setToken } from "@/app/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await auth.login(email, password);
      setToken(res.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Task Manager</h1>
          <p style={styles.subtitle}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    padding: "1rem",
  },
  card: {
    width: "100%",
    maxWidth: "380px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "2rem",
  },
  header: {
    marginBottom: "1.5rem",
  },
  title: {
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: "0.25rem",
  },
  subtitle: {
    color: "var(--text-muted)",
    fontSize: "0.875rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  error: {
    background: "#fef2f2",
    color: "var(--danger)",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    padding: "0.625rem 0.75rem",
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
    padding: "0.5rem 0.75rem",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    outline: "none",
    background: "var(--surface)",
    color: "var(--text)",
    transition: "border-color 0.15s",
  },
  button: {
    marginTop: "0.5rem",
    padding: "0.625rem",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontWeight: 500,
    fontSize: "0.875rem",
    transition: "background 0.15s",
  },
};
