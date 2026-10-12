"use client";
import { ReactNode } from "react";
import { compact, inr } from "@/lib/format";
import { Milestone } from "@/lib/types";

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success" | "info"; children: ReactNode }) {
  return <div className={`alert alert-${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}

export function Spinner({ label = "Loading..." }: { label?: string }) {
  return <div className="loading"><span className="spinner" />{label}</div>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return <div className="empty"><strong>{title}</strong>{hint && <p>{hint}</p>}</div>;
}

export function BudgetBar({ spent, total }: { spent: number; total: number }) {
  const pct = Math.min(100, Math.round((spent / total) * 100));
  return (
    <div>
      <div className="bar" aria-label={`${pct}% of budget spent`}><div className={`bar-fill ${pct >= 100 ? "full" : ""}`} style={{ width: `${pct}%` }} /></div>
      <div className="bar-meta"><span>{inr(spent)} spent</span><span>{inr(Math.max(0, total - spent))} remaining of {inr(total)}</span></div>
    </div>
  );
}

export function Ladder({ milestones, reached }: { milestones: Milestone[]; reached?: number }) {
  return (
    <div className="ladder">
      {milestones.map((m) => (
        <span key={m.views} className={`chip ${reached !== undefined && reached >= m.views ? "chip-hit" : ""}`}>
          {compact(m.views)} views → {inr(m.payout)}
        </span>
      ))}
    </div>
  );
}

export function PlatformBadge({ platform }: { platform: string }) {
  return <span className={`chip chip-${platform.toLowerCase()}`}>{platform}</span>;
}
