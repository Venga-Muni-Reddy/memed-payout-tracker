"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { Role, User } from "./types";

interface AuthState {
  user: User | null;
  token: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (input: { name: string; email: string; password: string; role: Role }) => Promise<User>;
  logout: () => void;
}
const Ctx = createContext<AuthState | null>(null);
const KEY = "memed.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Restore the session from localStorage, then confirm the token is still valid.
  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (!raw) { setReady(true); return; }
    const saved = JSON.parse(raw) as { token: string; user: User };
    api<{ user: User }>("/auth/me", { token: saved.token })
      .then((r) => { setToken(saved.token); setUser(r.user); })
      .catch(() => localStorage.removeItem(KEY))
      .finally(() => setReady(true));
  }, []);

  const persist = (t: string, u: User) => { localStorage.setItem(KEY, JSON.stringify({ token: t, user: u })); setToken(t); setUser(u); return u; };

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: { email, password } });
    return persist(r.token, r.user);
  }, []);
  const signup = useCallback(async (input: { name: string; email: string; password: string; role: Role }) => {
    const r = await api<{ token: string; user: User }>("/auth/signup", { method: "POST", body: input });
    return persist(r.token, r.user);
  }, []);
  const logout = useCallback(() => { localStorage.removeItem(KEY); setToken(null); setUser(null); }, []);

  return <Ctx.Provider value={{ user, token, ready, login, signup, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

/** Redirects to /login if signed out, or to the right dashboard if the role is wrong. */
export function useRequireRole(role: Role) {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!auth.ready) return;
    if (!auth.user) router.replace("/login");
    else if (auth.user.role !== role) router.replace(`/${auth.user.role}`);
  }, [auth.ready, auth.user, role, router]);
  return { ...auth, allowed: auth.ready && auth.user?.role === role };
}
