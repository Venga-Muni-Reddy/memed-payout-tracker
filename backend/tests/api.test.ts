import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app";
import { Campaign } from "../src/models/Campaign";

let mongo: MongoMemoryServer;
const app = createApp();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("test"));
  await mongoose.syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

let counter = 0;
async function signup(role: "brand" | "creator") {
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ name: `${role} ${++counter}`, email: `${role}${counter}@test.com`, password: "secret123", role });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, user: res.body.user };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function makeCampaign(brandToken: string, totalBudget = 10000, platform = "Instagram") {
  const res = await request(app)
    .post("/api/campaigns")
    .set(auth(brandToken))
    .send({
      name: "Summer drop",
      platform,
      totalBudget,
      milestones: [
        { views: 10000, payout: 500 },
        { views: 50000, payout: 2000 },
        { views: 100000, payout: 5000 },
      ],
    });
  expect(res.status).toBe(201);
  return res.body.campaign as { id: string };
}
async function submit(creatorToken: string, campaignId: string, n = Math.random()) {
  const res = await request(app)
    .post(`/api/campaigns/${campaignId}/submissions`)
    .set(auth(creatorToken))
    .send({ postUrl: `https://www.instagram.com/reel/${String(n).slice(2, 10)}${++counter}/` });
  expect(res.status).toBe(201);
  return res.body.submission as { id: string };
}
const setViews = (id: string, views: number) => request(app).patch(`/api/submissions/${id}/views`).send({ views });

describe("auth", () => {
  it("signs up, logs in and returns the profile for both roles", async () => {
    for (const role of ["brand", "creator"] as const) {
      const { user } = await signup(role);
      const login = await request(app).post("/api/auth/login").send({ email: user.email, password: "secret123" });
      expect(login.status).toBe(200);
      const me = await request(app).get("/api/auth/me").set(auth(login.body.token));
      expect(me.body.user.role).toBe(role);
    }
  });
  it("rejects duplicate email, wrong password and bad input", async () => {
    const { user } = await signup("brand");
    const dup = await request(app).post("/api/auth/signup").send({ name: "x", email: user.email, password: "secret123", role: "brand" });
    expect(dup.status).toBe(409);
    const bad = await request(app).post("/api/auth/login").send({ email: user.email, password: "nope" });
    expect(bad.status).toBe(401);
    const invalid = await request(app).post("/api/auth/signup").send({ name: "x", email: "bad", password: "1", role: "admin" });
    expect(invalid.status).toBe(400);
  });
  it("blocks routes without a token and enforces roles", async () => {
    expect((await request(app).get("/api/campaigns")).status).toBe(401);
    const brand = await signup("brand");
    const creator = await signup("creator");
    expect((await request(app).get("/api/campaigns").set(auth(brand.token))).status).toBe(403);
    expect((await request(app).post("/api/campaigns").set(auth(creator.token)).send({})).status).toBe(403);
  });
});

describe("campaigns", () => {
  it("brand creates a campaign and sees spent vs remaining; creator lists it", async () => {
    const brand = await signup("brand");
    const creator = await signup("creator");
    const c = await makeCampaign(brand.token, 8000);
    const mine = await request(app).get("/api/campaigns/mine").set(auth(brand.token));
    expect(mine.body.campaigns[0]).toMatchObject({ id: c.id, totalBudget: 8000, spent: 0, remaining: 8000, status: "live" });
    const live = await request(app).get("/api/campaigns").set(auth(creator.token));
    expect(live.body.campaigns.map((x: any) => x.id)).toContain(c.id);
  });
  it("validates the ladder and budget", async () => {
    const brand = await signup("brand");
    const post = (body: object) => request(app).post("/api/campaigns").set(auth(brand.token)).send(body);
    expect((await post({ name: "a", platform: "TikTok", totalBudget: 100, milestones: [{ views: 1, payout: 1 }] })).status).toBe(400);
    expect((await post({ name: "a", platform: "YouTube", totalBudget: 100, milestones: [] })).status).toBe(400);
    expect((await post({ name: "a", platform: "YouTube", totalBudget: 100, milestones: [{ views: 10, payout: 50 }, { views: 20, payout: 20 }] })).status).toBe(400);
    expect((await post({ name: "a", platform: "YouTube", totalBudget: 100, milestones: [{ views: 10, payout: 500 }] })).status).toBe(400);
  });
  it("only accepts links that match the campaign platform and blocks duplicates", async () => {
    const brand = await signup("brand");
    const creator = await signup("creator");
    const c = await makeCampaign(brand.token, 5000, "YouTube");
    const url = (u: string) => request(app).post(`/api/campaigns/${c.id}/submissions`).set(auth(creator.token)).send({ postUrl: u });
    expect((await url("https://www.instagram.com/reel/abc/")).status).toBe(400);
    expect((await url("https://youtu.be/abc123")).status).toBe(201);
    expect((await url("https://youtu.be/abc123")).status).toBe(409);
  });
});

describe("views and payouts", () => {
  it("pays the highest milestone crossed and only the difference on later updates", async () => {
    const brand = await signup("brand");
    const creator = await signup("creator");
    const c = await makeCampaign(brand.token, 10000);
    const s = await submit(creator.token, c.id);

    expect((await setViews(s.id, 9000)).body.paidNow).toBe(0);
    expect((await setViews(s.id, 12000)).body).toMatchObject({ paidNow: 500, paidOut: 500 });
    expect((await setViews(s.id, 60000)).body).toMatchObject({ paidNow: 1500, paidOut: 2000 });

    const earnings = await request(app).get("/api/submissions/earnings/total").set(auth(creator.token));
    expect(earnings.body.totalEarnings).toBe(2000);
    const mine = await request(app).get("/api/campaigns/mine").set(auth(brand.token));
    expect(mine.body.campaigns[0]).toMatchObject({ spent: 2000, remaining: 8000 });
  });

  it("crossing two milestones in one update pays only the highest one (not the sum)", async () => {
    const brand = await signup("brand");
    const creator = await signup("creator");
    const c = await makeCampaign(brand.token, 10000);
    const s = await submit(creator.token, c.id);
    expect((await setViews(s.id, 120000)).body).toMatchObject({ paidNow: 5000, paidOut: 5000 });
  });

  it("repeating the same update never double-pays and lower counts are ignored", async () => {
    const brand = await signup("brand");
    const creator = await signup("creator");
    const c = await makeCampaign(brand.token, 10000);
    const s = await submit(creator.token, c.id);
    await setViews(s.id, 55000);
    const again = await setViews(s.id, 55000);
    expect(again.body).toMatchObject({ paidNow: 0, paidOut: 2000 });
    const lower = await setViews(s.id, 100);
    expect(lower.body).toMatchObject({ paidNow: 0, paidOut: 2000, views: 55000 });
  });

  it("caps payouts at the remaining budget (partial payout, then nothing)", async () => {
    const brand = await signup("brand");
    const creator = await signup("creator");
    const c = await makeCampaign(brand.token, 5200);
    const a = await submit(creator.token, c.id);
    const b = await submit(creator.token, c.id);
    expect((await setViews(a.id, 100000)).body).toMatchObject({ paidNow: 5000, budgetRemaining: 200 });
    const partial = await setViews(b.id, 100000);
    expect(partial.body).toMatchObject({ paidNow: 200, paidOut: 200, owedButUnpaid: 4800, budgetRemaining: 0 });
    expect((await setViews(b.id, 200000)).body.paidNow).toBe(0);

    const camp = await Campaign.findById(c.id);
    expect(camp!.spent).toBe(5200);
    const live = await request(app).get("/api/campaigns").set(auth(creator.token));
    expect(live.body.campaigns.map((x: any) => x.id)).not.toContain(c.id);
    const late = await request(app).post(`/api/campaigns/${c.id}/submissions`).set(auth(creator.token)).send({ postUrl: "https://instagram.com/p/zzz/" });
    expect(late.status).toBe(409);
  });

  it("flags a suspicious spike", async () => {
    const brand = await signup("brand");
    const creator = await signup("creator");
    const c = await makeCampaign(brand.token, 10000);
    const s = await submit(creator.token, c.id);
    await setViews(s.id, 2000);
    const res = await setViews(s.id, 40000);
    expect(res.body.flagged).toBe(true);
    const list = await request(app).get(`/api/campaigns/${c.id}/submissions`).set(auth(brand.token));
    expect(list.body.submissions[0].flagged).toBe(true);
  });

  it("validates the views payload and unknown ids", async () => {
    expect((await request(app).patch("/api/submissions/abc/views").send({ views: 5 })).status).toBe(404);
    expect((await request(app).patch("/api/submissions/507f1f77bcf86cd799439011/views").send({ views: 5 })).status).toBe(404);
    const brand = await signup("brand");
    const creator = await signup("creator");
    const s = await submit(creator.token, (await makeCampaign(brand.token)).id);
    expect((await setViews(s.id, -5)).status).toBe(400);
    expect((await request(app).patch(`/api/submissions/${s.id}/views`).send({ views: "lots" })).status).toBe(400);
  });
});

describe("concurrency", () => {
  it("simultaneous updates on different posts never overspend the budget", async () => {
    const brand = await signup("brand");
    const creator = await signup("creator");
    const c = await makeCampaign(brand.token, 12000);
    const subs = await Promise.all(Array.from({ length: 8 }, () => submit(creator.token, c.id)));
    const results = await Promise.all(subs.map((s) => setViews(s.id, 100000)));
    results.forEach((r) => expect(r.status).toBe(200));
    const camp = await Campaign.findById(c.id);
    expect(camp!.spent).toBe(12000);
    const paid = results.reduce((sum, r) => sum + r.body.paidNow, 0);
    expect(paid).toBe(12000);
  });

  it("simultaneous identical updates on one post pay exactly once", async () => {
    const brand = await signup("brand");
    const creator = await signup("creator");
    const c = await makeCampaign(brand.token, 10000);
    const s = await submit(creator.token, c.id);
    const results = await Promise.all(Array.from({ length: 12 }, () => setViews(s.id, 100000)));
    results.forEach((r) => expect(r.status).toBe(200));
    expect(results.reduce((sum, r) => sum + r.body.paidNow, 0)).toBe(5000);
    expect((await Campaign.findById(c.id))!.spent).toBe(5000);
  });
});
