"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, AuthUser, removeToken } from "@/app/lib/api";

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth
      .me()
      .then((res) => setUser(res))
      .catch(() => {
        removeToken();
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    try {
      await auth.logout();
    } catch {
      // ignore
    }
    removeToken();
    router.replace("/login");
  }

  return { user, loading, logout };
}
