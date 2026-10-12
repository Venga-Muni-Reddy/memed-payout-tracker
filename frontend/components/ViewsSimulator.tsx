"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { inr } from "@/lib/format";
import { Submission, ViewsResult } from "@/lib/types";

/**
 * Stands in for the platform (Instagram / YouTube) pushing a new view count.
 * Calls PATCH /api/submissions/:id/views, which has no role check by design.
 */
export default function ViewsSimulator({ submission, onUpdated }: { submission: Submission; onUpdated: () => void }) {
  const [value, setValue] = useState(String(submission.views));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  async function send() {
    setMsg(null);
    const views = Number(value);
    if (!Number.isInteger(views) || views < 0) { setMsg({ kind: "error", text: "Enter a whole number" }); return; }
    setBusy(true);
    try {
      const r = await api<ViewsResult>(`/submissions/${submission.id}/views`, { method: "PATCH", body: { views } });
      setMsg({
        kind: "ok",
        text: r.paidNow > 0
          ? `Paid ${inr(r.paidNow)}${r.owedButUnpaid > 0 ? ` (budget ran short, ${inr(r.owedButUnpaid)} unpaid)` : ""}`
          : r.owedButUnpaid > 0 ? "Budget exhausted - nothing paid" : "No new payout",
      });
      setValue(String(r.views));
      onUpdated();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sim">
      <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} aria-label="New view count" />
      <button className="btn btn-small" onClick={send} disabled={busy}>{busy ? "..." : "Update views"}</button>
      {msg && <span className={`sim-msg ${msg.kind}`}>{msg.text}</span>}
    </div>
  );
}
