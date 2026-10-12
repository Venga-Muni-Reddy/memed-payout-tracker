"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { compact, inr } from "@/lib/format";
import { Campaign, Submission } from "@/lib/types";
import { Alert, BudgetBar, Empty, Ladder, PlatformBadge, Spinner, Stat } from "@/components/ui";
import CampaignForm from "@/components/CampaignForm";
import ViewsSimulator from "@/components/ViewsSimulator";

function CampaignCard({ campaign, token, onChange }: { campaign: Campaign; token: string; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [error, setError] = useState("");

  const loadSubs = useCallback(async () => {
    try {
      const r = await api<{ submissions: Submission[] }>(`/campaigns/${campaign.id}/submissions`, { token });
      setSubs(r.submissions);
    } catch (e) { setError((e as Error).message); }
  }, [campaign.id, token]);

  useEffect(() => { if (open) loadSubs(); }, [open, loadSubs, campaign.spent]);

  return (
    <div className="card campaign">
      <div className="campaign-top">
        <div>
          <h3>{campaign.name}</h3>
          <div className="row-gap"><PlatformBadge platform={campaign.platform} />
            <span className={`chip ${campaign.status === "live" ? "chip-live" : "chip-done"}`}>{campaign.status === "live" ? "Live" : "Budget used up"}</span>
            <span className="muted small">{campaign.submissionCount ?? 0} post{campaign.submissionCount === 1 ? "" : "s"}</span>
            {!!campaign.flaggedCount && <span className="chip chip-flag">⚑ {campaign.flaggedCount} flagged</span>}
          </div>
        </div>
      </div>
      <BudgetBar spent={campaign.spent} total={campaign.totalBudget} />
      <Ladder milestones={campaign.milestones} />
      <button className="btn btn-ghost btn-small" onClick={() => setOpen((o) => !o)}>{open ? "Hide posts" : "View posts"}</button>
      {open && (
        <div className="subs">
          {error && <Alert kind="error">{error}</Alert>}
          {!subs ? <Spinner /> : subs.length === 0 ? <Empty title="No posts yet" hint="Creators will appear here once they submit links." /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Creator</th><th>Post</th><th className="num">Views</th><th className="num">Paid</th><th>Simulate platform views</th></tr></thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id}>
                      <td>{s.creatorName}</td>
                      <td><a href={s.postUrl} target="_blank" rel="noreferrer">{s.postUrl.replace(/^https?:\/\/(www\.)?/, "").slice(0, 34)}</a>
                        {s.flagged && <span className="chip chip-flag" title={s.flagReason}>⚑ spike</span>}</td>
                      <td className="num">{compact(s.views)}</td>
                      <td className="num">{inr(s.paidOut)}</td>
                      <td><ViewsSimulator submission={s} onUpdated={() => { onChange(); loadSubs(); }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BrandPage() {
  const { token, user, allowed } = useRequireRole("brand");
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setCampaigns((await api<{ campaigns: Campaign[] }>("/campaigns/mine", { token })).campaigns);
    } catch (e) { setError((e as Error).message); }
  }, [token]);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  if (!allowed || !token) return <Spinner />;
  const total = campaigns?.reduce((s, c) => s + c.totalBudget, 0) ?? 0;
  const spent = campaigns?.reduce((s, c) => s + c.spent, 0) ?? 0;

  return (
    <>
      <div className="page-head"><h1>Hi, {user?.name}</h1><p className="muted">Create campaigns and watch your budget turn into creator payouts.</p></div>
      <div className="stats">
        <Stat label="Campaigns" value={String(campaigns?.length ?? 0)} />
        <Stat label="Total budget" value={inr(total)} />
        <Stat label="Spent" value={inr(spent)} tone="warn" />
        <Stat label="Remaining" value={inr(total - spent)} tone="good" />
      </div>
      <div className="two-col">
        <CampaignForm token={token} onCreated={load} />
        <section>
          <h2>Your campaigns</h2>
          {error && <Alert kind="error">{error}</Alert>}
          {!campaigns ? <Spinner /> : campaigns.length === 0 ? <Empty title="No campaigns yet" hint="Create your first campaign with the form." /> :
            campaigns.map((c) => <CampaignCard key={c.id} campaign={c} token={token} onChange={load} />)}
        </section>
      </div>
    </>
  );
}
