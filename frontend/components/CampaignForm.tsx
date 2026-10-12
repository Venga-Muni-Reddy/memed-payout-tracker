"use client";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { Alert } from "@/components/ui";

interface Row { views: string; payout: string }

export default function CampaignForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"Instagram" | "YouTube">("Instagram");
  const [budget, setBudget] = useState("");
  const [rows, setRows] = useState<Row[]>([{ views: "10000", payout: "500" }, { views: "50000", payout: "2000" }, { views: "100000", payout: "5000" }]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const setRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setOk("");
    setBusy(true);
    try {
      await api("/campaigns", {
        method: "POST", token,
        body: { name, platform, totalBudget: Number(budget), milestones: rows.map((r) => ({ views: Number(r.views), payout: Number(r.payout) })) },
      });
      setOk(`Campaign "${name}" is live.`);
      setName(""); setBudget("");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Create a campaign</h2>
      {error && <Alert kind="error">{error}</Alert>}
      {ok && <Alert kind="success">{ok}</Alert>}
      <div className="grid-3">
        <label>Campaign name<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Summer launch clips" /></label>
        <label>Platform
          <select value={platform} onChange={(e) => setPlatform(e.target.value as "Instagram" | "YouTube")}>
            <option>Instagram</option><option>YouTube</option>
          </select>
        </label>
      </div>
      <label>Total budget (₹)<input type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} required placeholder="50000" /></label>
      <div className="ladder-edit">
        <div className="ladder-head"><span>Milestone ladder</span><span className="muted small">Creators are paid the highest milestone their post crosses</span></div>
        {rows.map((r, i) => (
          <div className="ladder-row" key={i}>
            <input type="number" min={1} value={r.views} onChange={(e) => setRow(i, { views: e.target.value })} required aria-label={`Milestone ${i + 1} views`} placeholder="Views" />
            <span className="arrow">→ ₹</span>
            <input type="number" min={1} value={r.payout} onChange={(e) => setRow(i, { payout: e.target.value })} required aria-label={`Milestone ${i + 1} payout`} placeholder="Payout" />
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} disabled={rows.length === 1} aria-label="Remove milestone">✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setRows((x) => [...x, { views: "", payout: "" }])}>+ Add milestone</button>
      </div>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Creating..." : "Create campaign"}</button>
    </form>
  );
}
