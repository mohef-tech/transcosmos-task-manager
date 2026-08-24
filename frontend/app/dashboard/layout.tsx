"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div style={styles.loadingRoot}>
        <span style={styles.loadingDot} />
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={styles.brandText}>Tasks</span>
        </div>

        <nav style={styles.nav}>
          <Link
            href="/dashboard"
            style={{
              ...styles.navLink,
              ...(pathname === "/dashboard" ? styles.navLinkActive : {}),
            }}
          >
            All Tasks
          </Link>
        </nav>

        <div style={styles.sidebarBottom}>
          {user && (
            <div style={styles.userInfo}>
              <span style={styles.userName}>{user.name}</span>
              <span style={styles.userRole}>{user.role}</span>
            </div>
          )}
          <button onClick={logout} style={styles.logoutBtn}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingRoot: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--text-muted)",
  },
  root: {
    display: "flex",
    minHeight: "100vh",
  },
  sidebar: {
    width: "200px",
    flexShrink: 0,
    background: "var(--surface)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    padding: "1rem 0",
  },
  brand: {
    padding: "0 1rem 1rem",
    borderBottom: "1px solid var(--border)",
    marginBottom: "0.5rem",
  },
  brandText: {
    fontWeight: 600,
    fontSize: "0.9375rem",
    color: "var(--text)",
  },
  nav: {
    flex: 1,
    padding: "0.5rem 0.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  navLink: {
    display: "block",
    padding: "0.4375rem 0.625rem",
    borderRadius: "5px",
    fontSize: "0.875rem",
    color: "var(--text-muted)",
    fontWeight: 450,
  },
  navLinkActive: {
    background: "#eff6ff",
    color: "var(--accent)",
    fontWeight: 500,
  },
  sidebarBottom: {
    padding: "1rem",
    borderTop: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  userName: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "var(--text)",
  },
  userRole: {
    fontSize: "0.75rem",
    color: "var(--text-muted)",
    textTransform: "capitalize",
  },
  logoutBtn: {
    padding: "0.4375rem 0.625rem",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "5px",
    fontSize: "0.8125rem",
    color: "var(--text-muted)",
    textAlign: "left",
  },
  main: {
    flex: 1,
    overflow: "auto",
    padding: "1.5rem 2rem",
  },
};
