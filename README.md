# Meme'd Campaign Payout Tracker

A small creator marketplace. **Brands** create campaigns with a budget and a milestone ladder. **Creators** submit Instagram or YouTube posts to those campaigns and get paid as the post crosses view milestones. A campaign never pays out more than its budget.

- **Backend:** Node.js, TypeScript, Express 5, MongoDB with Mongoose, JWT auth, Zod validation
- **Frontend:** Next.js (App Router), TypeScript, plain CSS
- **Tests:** Jest (unit tests for the payout maths and budget cap, plus API and concurrency tests against a real in-memory MongoDB)

Live app: _add the deployed URL here_  
API: _add the deployed API URL here_

## Run it locally

You need Node.js 20+ and either a MongoDB connection string or nothing at all (development mode starts an in-memory MongoDB for you).

```bash
# 1. Backend
cd backend
cp .env.example .env          # edit MONGODB_URI, or leave it empty to use the in-memory DB in dev
npm install
npm run dev                   # http://localhost:4000

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:3000
```

Run the tests: `cd backend && npm test`

### Environment variables

| Where | Variable | Purpose |
| --- | --- | --- |
| backend | `MONGODB_URI` | MongoDB connection string. Required in production. Empty in dev = in-memory MongoDB |
| backend | `JWT_SECRET` | Secret used to sign tokens. Use a long random string in production |
| backend | `JWT_EXPIRES_IN` | Token lifetime, default `7d` |
| backend | `CORS_ORIGIN` | Allowed frontend origin(s), comma separated. `*` allows all |
| backend | `PORT` | Default `4000` |
| frontend | `NEXT_PUBLIC_API_URL` | Base URL of the backend, no trailing slash |

Production build: `cd backend && npm run build && npm start` and `cd frontend && npm run build && npm start`.

## How payouts work

A ladder looks like `10K views -> Rs 500`, `50K -> Rs 2,000`, `100K -> Rs 5,000`.

1. A post's payout is the amount of the **highest milestone its views have crossed**. It is not a running total of every milestone.
2. A creator is paid the **difference** between that amount and what the post has already been paid.
3. The campaign pays at most its **remaining budget**. If the money runs short, the creator gets the remainder.

Example: a post goes 12K views (paid 500), then 60K views (paid 1,500 more, total 2,000), then 60K again (paid 0).

## API

All routes are under `/api`. Protected routes need `Authorization: Bearer <token>`.

| Method and path | Who | What |
| --- | --- | --- |
| `POST /auth/signup` | public | `{name, email, password, role: "brand" or "creator"}` returns token and user |
| `POST /auth/login` | public | `{email, password}` returns token and user |
| `GET /auth/me` | any user | current user |
| `POST /campaigns` | brand | create a campaign: `{name, platform, totalBudget, milestones: [{views, payout}]}` |
| `GET /campaigns/mine` | brand | own campaigns with `totalBudget`, `spent`, `remaining`, post and flagged counts |
| `GET /campaigns/:id/submissions` | brand (owner) | posts submitted to one of their campaigns |
| `GET /campaigns` | creator | live campaigns (budget not used up) |
| `POST /campaigns/:id/submissions` | creator | submit a post link: `{postUrl}` |
| `GET /submissions/mine` | creator | own posts with views and earnings |
| `GET /submissions/earnings/total` | creator | `{totalEarnings}` |
| `PATCH /submissions/:id/views` | **public by design** | `{views}`. Simulates the platform reporting a new view count and pays out what is due |

Errors always look like `{ "error": "message" }` with a sensible status (400 validation, 401 and 403 auth, 404, 409 conflicts).

## Assumptions and decisions on open cases

- **A post crosses two milestones in one update:** the creator gets the highest milestone only, minus what was already paid. Example: 0 to 120K views in one update pays 5,000, not 500 + 2,000 + 5,000.
- **The budget runs out mid-payout:** the creator gets a partial payout of whatever is left. The response reports `owedButUnpaid`. Nothing is queued for later: once the budget is gone, further updates pay 0 and the campaign disappears from the creator's live list.
- **View counts never go down:** a lower number than what is stored is treated as stale and ignored. Payouts are never clawed back.
- **Money is in whole rupees** (integers), which avoids floating point errors.
- **Ladder rules:** thresholds must be unique positive whole numbers, a higher milestone cannot pay less than a lower one, and no single payout can exceed the total budget.
- **Platform link check:** an Instagram campaign accepts only `instagram.com` links and a YouTube campaign accepts `youtube.com` or `youtu.be` links. The same link cannot be submitted twice to one campaign. The app does not verify the post exists or fetch real views, since the brief says the PATCH endpoint simulates platform data.
- **Live campaign** means budget is not fully spent. There is no manual pause or end date.
- **The PATCH views endpoint has no auth**, as the brief says. In the UI it appears as an "Update views" control so the flow can be demonstrated. In real life this would be a signed webhook or a server-side job.
- **Bonus implemented - spike flag:** a submission is flagged when it already had at least 1,000 views and one update adds 5x that many or more. The brand sees a flag on the post. Redis caching was not done.

## Concurrency and no double payment (stretch)

Two requests can arrive at the same moment, so the update is built to be safe without database transactions:

1. **Reserve the money first** with one atomic `findOneAndUpdate` on the campaign that sets `spent = min(totalBudget, spent + owed)`. MongoDB applies it one at a time, so two requests can never both take the last rupees.
2. **Record it on the post with a compare-and-set** on the `paidOut` and `views` values that were read. If another request changed the post first, the compare fails, the reserved money is returned to the campaign, and the update retries on fresh data. A repeated update therefore can never pay twice.

Tests in `backend/tests/api.test.ts` fire 8 posts at a 12,000 budget at once and 12 identical updates on one post at once, and check the totals exactly.

## How this would scale to 10,000 creators

The payout step is the only part with a shared hot spot (one campaign document per campaign), so the plan is mostly about protecting that.

- **Indexes:** submissions are indexed by campaign and by creator, and `(campaign, postUrl)` is unique. Add a compound index for listing live campaigns once the list grows, and paginate every list endpoint.
- **View updates:** move from a direct PATCH to a queue (SQS, BullMQ or similar). Workers apply updates in batches and one post's updates are processed in order. This smooths bursts from the platforms.
- **Hot campaigns:** a very popular campaign serialises on one document. If that becomes a bottleneck, split the budget into per-shard buckets (for example 10 slices) and draw from a random slice, topping up from the others when a slice is empty.
- **Reads:** cache the campaign list (Redis, short TTL) and keep dashboards on read replicas. Budget totals shown to brands can be slightly stale.
- **Fraud and accuracy:** keep the spike flag, and add a review step before payouts above a limit.
- **Operations:** stateless API instances behind a load balancer, structured logs, rate limiting on auth and the public PATCH route, and an audit table of every payout (who, how much, when) rather than only running totals.

## Project layout

```
backend/
  src/
    server.ts            starts MongoDB and the HTTP server
    app.ts               Express app, routes, central error handler
    config.ts            reads environment variables
    models/              User, Campaign, Submission (Mongoose)
    routes/              auth, campaigns, submissions
    middleware/auth.ts   JWT check and role check
    services/payout.ts   pure payout rules (unit tested)
    services/viewsService.ts  atomic views update and payout
  tests/                 payout.test.ts (unit), api.test.ts (API + concurrency)
frontend/
  app/                   login, signup, brand and creator pages
  components/            forms, tables, shared UI
  lib/                   API client, auth context, formatting
```
