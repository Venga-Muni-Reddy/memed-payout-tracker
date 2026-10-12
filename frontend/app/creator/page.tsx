"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { compact, inr } from "@/lib/format";
import { Campaign, Submission } from "@/lib/types";
import { Alert, BudgetBar, Empty, Ladder, PlatformBadge, Spinner, Stat } from "@/components/ui";
import ViewsSimulator from "@/components/ViewsSimulator";

function SubmitPost({ campaign, token, onDone }: { campaign: Campaign; token: string; onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      await api(`/campaigns/${campaign.id}/submissions`, { method: "POST", token, body: { postUrl: url } });
      setMsg({ kind: "success", text: "Post submitted." });
      setUrl(""); onDone();
    } catch (err) { setMsg({ kind: "error", text: (err as Error).message }); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="submit-post">
      <div className="inline-form">
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder={campaign.platform === "Instagram" ? "https://www.instagram.com/reel/..." : "https://www.youtube.com/watch?v=..."} aria-label="Post link" />
        <button className="btn btn-primary" disabled={busy}>{busy ? "..." : "Submit post"}</button>
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </form>
  );
}

export default function CreatorPage() {
  const { token, user, allowed } = useRequireRole("creator");
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [c, s, e] = await Promise.all([
        api<{ campaigns: Campaign[] }>("/campaigns", { token }),
        api<{ submissions: Submission[] }>("/submissions/mine", { token }),
        api<{ totalEarnings: number }>("/submissions/earnings/total", { token }),
      ]);
      setCampaigns(c.campaigns); setSubs(s.submissions); setTotal(e.totalEarnings);
    } catch (e) { setError((e as Error).message); }
  }, [token]);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  if (!allowed || !token) return <Spinner />;

  return (
    <>
      <div className="page-head"><h1>Hi, {user?.name}</h1><p className="muted">Pick a live campaign, submit your post, and track what you have earned.</p></div>
      <div className="stats">
        <Stat label="Total earnings" value={inr(total)} tone="good" />
        <Stat label="Posts submitted" value={String(subs?.length ?? 0)} />
        <Stat label="Live campaigns" value={String(campaigns?.length ?? 0)} />
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="two-col">
        <section>
          <h2>Live campaigns</h2>
          {!campaigns ? <Spinner /> : campaigns.length === 0 ? <Empty title="No live campaigns right now" hint="Check back soon." /> :
            campaigns.map((c) => (
              <div className="card campaign" key={c.id}>
                <h3>{c.name}</h3>
                <div className="row-gap"><PlatformBadge platform={c.platform} />{c.brandName && <span className="muted small">by {c.brandName}</span>}</div>
                <BudgetBar spent={c.spent} total={c.totalBudget} />
                <Ladder milestones={c.milestones} />
                <SubmitPost campaign={c} token={token} onDone={load} />
              </div>
            ))}
        </section>
        <section>
          <h2>My posts &amp; earnings</h2>
          {!subs ? <Spinner /> : subs.length === 0 ? <Empty title="No posts yet" hint="Submit a link to a campaign to start earning." /> : (
            <div className="card table-wrap">
              <table>
                <thead><tr><th>Campaign</th><th>Post</th><th className="num">Views</th><th className="num">Earned</th></tr></thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id}>
                      <td>{s.campaignName}<div className="muted small">{s.platform}</div></td>
                      <td><a href={s.postUrl} target="_blank" rel="noreferrer">{s.postUrl.replace(/^https?:\/\/(www\.)?/, "").slice(0, 28)}</a>
                        <div className="muted small tiny-label">Simulate platform views</div>
                        <ViewsSimulator submission={s} onUpdated={load} /></td>
                      <td className="num">{compact(s.views)}</td>
                      <td className="num strong">{inr(s.paidOut)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
