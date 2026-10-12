"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Role } from "@/lib/types";
import { Alert } from "@/components/ui";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { login, signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("creator");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = mode === "login" ? await login(email, password) : await signup({ name, email, password, role });
      router.push(`/${user.role}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">{mode === "login" ? "Log in to manage campaigns or track your earnings." : "Brands launch campaigns. Creators get paid for views."}</p>
        {error && <Alert kind="error">{error}</Alert>}
        {mode === "signup" && (
          <>
            <div className="role-pick" role="radiogroup" aria-label="Account type">
              {(["creator", "brand"] as Role[]).map((r) => (
                <button type="button" key={r} role="radio" aria-checked={role === r} className={`role-opt ${role === r ? "active" : ""}`} onClick={() => setRole(r)}>
                  <strong>{r === "creator" ? "Creator" : "Brand"}</strong>
                  <span>{r === "creator" ? "Post content, earn payouts" : "Run campaigns, set budgets"}</span>
                </button>
              ))}
            </div>
            <label>{role === "brand" ? "Brand name" : "Your name"}<input value={name} onChange={(e) => setName(e.target.value)} required placeholder={role === "brand" ? "Acme Co." : "Your name or page name"} /></label>
          </>
        )}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="email" /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "signup" ? 6 : undefined} placeholder={mode === "signup" ? "At least 6 characters" : "Your password"} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}</button>
        <p className="muted center">
          {mode === "login" ? <>New here? <Link href="/signup">Create an account</Link></> : <>Already have an account? <Link href="/login">Log in</Link></>}
        </p>
      </form>
    </div>
  );
}
