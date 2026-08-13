# Scope: LLM Arena

Send one prompt, watch up to three AI models answer it at the same time, and vote for the best one. Over time those votes and the real per-call numbers, speed, tokens, cost, build an honest leaderboard of which model is actually worth using.

Build it in a thin, working slice first, one prompt actually reaching a model and coming back, before making any single part of it fuller. Then thicken it piece by piece. Before building anything, decide what you're doing and why in a few plain sentences, then build it, and if the plan turns out wrong once it's actually built, say so and fix the plan too, not just the code.

Whenever a "build it" style step actually gets underway, break it into its own short list of what's genuinely being done, and check each part off as it's finished, right in this file. That way this file can be opened fresh, in a brand new conversation, and it's obvious what's already done and what's still left, without anyone re-explaining the feature from scratch.

## Stack

Already decided, nothing open here: Next.js (App Router), TypeScript, Tailwind, shadcn for components (card, button, popover, loading skeleton, and whatever else the UI actually needs as it gets built), Prisma with Postgres, Clerk for auth, Arcjet in front of the endpoint, PostHog for analytics and observability.

## Sketches

There are rough hand-drawn sketches for the arena screen, the leaderboard, and the models page. Treat them as structure only, where things sit, what exists on the page, not as the final design or the actual colors, all of that is already decided elsewhere in this file. If something in a sketch genuinely contradicts what's written here, stop and ask which one actually wins rather than guessing.

## At a glance

| #   | Feature                                     | Phase      | Status      |
| --- | ------------------------------------------- | ---------- | ----------- |
| 1   | Connecting to a model                       | Foundation | done        |
| 2   | Coding standards & tooling                  | Foundation | not started |
| 3   | Data model                                  | Foundation | in progress |
| 4   | Design & look                               | Foundation | not started |
| 5   | Model picker                                | Slice 1    | not started |
| 6   | Send a prompt, parallel streams, and voting | Slice 1    | not started |
| 7   | App shell & thread history                  | Slice 2    | not started |
| 8   | Public thread visibility & sharing          | Slice 3    | not started |
| 9   | Leaderboard: global & personal              | Slice 4    | not started |

## Foundation

### 1. How the app actually connects to a model

The Next.js project itself gets created manually first, `create-next-app`, fast and simple, no reason to spend agent time or tokens on something that easy.

Two real decisions still open once that exists: how the app calls OpenRouter to get a model's answer, and how streaming three models back to the browser at once should actually work. This one's worth real thought: routing all three through one shared connection looks simpler, but if that one connection drops, all three answers die together, which breaks the whole point of one model failing never affecting the others. Decide both properly, then wire them, along with Prisma, Clerk, and Arcjet, into the project that already exists.

PostHog should be wired in from the start too, session replay and heatmaps turned on, and tied to the signed-in user once Clerk resolves, so events are attached to a real person, not left anonymous.

- [x] Decide the approach
- [x] Write the spec

#### What was decided

**One HTTP request per model.** Three selected models means three independent
`POST /api/chat` calls, each carrying a single model id and returning its own
stream. Not one shared connection fanned out server-side. The shared connection
is less plumbing but it couples the three answers: a dropped socket kills all
three at once, and that is exactly the failure the product is supposed to make
impossible. Independence is the whole point, so it gets paid for up front.

**Vercel AI SDK v7 with `@openrouter/ai-sdk-provider`,** rather than hand-rolled
`fetch` and SSE parsing, or the OpenAI SDK pointed at OpenRouter. It hands over
streaming, cancellation, typed usage accounting, and per-chunk callbacks, and
feature 6's PostHog LLM analytics has a real place to attach. One provider
instance, in `features/models/openrouter.ts`, with app-attribution headers set.

**Timing is measured on the server**, in `features/chat/call-metrics.ts`. Timing
on the client would fold the user's own network into every number, so a model
would look slow because someone is on hotel wifi. The arithmetic is a pure
function; the stopwatch around it is the only mutable cell, scoped to one
request.

**Node runtime**, the App Router default, left unset. Edge would fight both
Prisma and long free-tier streams. `maxDuration` is raised to 60s because free
models are genuinely slow.

**Env is parsed once at import time** in `env.ts` and imported from
`instrumentation.ts`, so a missing variable kills the server on boot and lists
every problem at once, instead of surfacing on someone's first prompt. It is
marked `server-only` and validates only what the code actually reads today; it
grows as features land.

**Errors never reach the user raw.** The route logs the real provider exception
server-side and the stream carries a plain sentence. Verified against a real
upstream rate-limit, not a simulated one.

#### Corrected while building

- **No `POST /api/turns` yet.** The plan had a separate turn-creation call
  before the fan-out, so three concurrent requests would not race to create the
  same turn row. That endpoint is a pure database write and there is no schema
  and no `DATABASE_URL` yet, so it belongs to feature 3, not here. The race is
  real and still has to be solved — it is written down in feature 3 below so it
  does not get lost. Feature 1 ships the streaming path only, stateless.
- **Tokens per second was measured wrongly at first,** and reported rates like
  22,000 tokens/sec. Cause: the clock started at the first *text* token, but
  several free models are reasoning models that think for seconds first, and
  the provider counts those reasoning tokens in `outputTokens`. A full token
  count was being divided by a partial window. The clock now starts at the
  first content chunk of any kind. A provider that returns everything in one
  chunk reports no rate at all rather than an invented one — there is genuinely
  nothing to measure there.
- **PostHog is not wired.** No PostHog key exists yet; it needs a project key
  before anything real can be turned on. Prisma was in this list too and its
  connection is now live — see "Prisma is connected" under feature 3. Arcjet
  was here as well and has since been built — see "Arcjet, built ahead of
  schedule" under feature 6.
- **Clerk was already wired** by hand before this step ran — `proxy.ts`
  (Next 16 renamed `middleware.ts` to `proxy.ts`), sign-in and sign-up routes,
  and `features/auth/auth-controls.tsx`. Nothing was re-done. `/api/chat`
  requires a signed-in user today; Arcjet now sits directly behind that check.

#### Verified by hand

Real free models over a running dev server, no test runner:

- Unauthenticated `POST /api/chat` → 401 and a plain sentence.
- Authenticated, via a real Clerk session token, streaming from
  `inclusionai/ling-3.0-tiny:free`, `nvidia/nemotron-3.5-lightning:free`, and
  `google/gemma-4-26b-a4b-it:free` — 466.7, 245.2, and 8.7 tokens/sec, TTFT 656ms,
  288ms, and 634ms. Plausible, clearly different per model.
- A genuine upstream rate-limit on `google/gemma-4-31b-it:free` produced the
  full provider error in the server log and "That model didn't answer. You can
  try it again." in the stream.
- `tsc --noEmit`, `pnpm lint`, and `pnpm build` all clean.

### 2. Coding standards & tooling

Write down the real conventions for this project once it actually exists, then install linting, formatting, and a pre-commit hook that actually enforces them.

- [ ] Decide the approach
- [ ] Install lint, format, and whatever else is needed, and write it up in a coding-standards doc

### 3. Data model

The core things every feature depends on: users tied to Clerk, threads, each model's own messages inside a thread, and votes. A vote should only ever be possible on a turn where two or more models actually answered.

Carried over from feature 1, which decided one HTTP request per model: the
three parallel `/api/chat` calls that make up a single turn must not each try
to create that turn. Either a small non-streaming call creates the turn and its
pending messages first and the three streams attach to the ids it returns, or
the three calls resolve it idempotently from a client-generated turn id. The
first is preferred — it keeps concurrency handling out of the hot path — but it
is a data-model decision, so it gets made here.

- [x] Prisma connected and proven against the real database (see below)
- [ ] Decide the approach
- [ ] Build it

#### Prisma is connected

The plumbing landed ahead of the schema decision, on request. There are
deliberately **no models yet** — `prisma/schema.prisma` holds only a generator
and a datasource. Inventing tables inside a setup step would have quietly
pre-empted the "Decide the approach" item still open above, and that decision
covers the vote constraint and the turn-creation race, neither of which should
be settled by accident.

**Prisma 7 is meaningfully different** from every older tutorial, and three of
those differences are load-bearing here:

- **No Rust query engine, so a driver adapter is mandatory.** The client is
  constructed as `new PrismaClient({ adapter: new PrismaPg({ ... }) })`. That
  is why `@prisma/adapter-pg` and `pg` are real dependencies rather than
  optional extras.
- **The generator is `prisma-client`, not `prisma-client-js`, and `output` is
  required.** The client is generated into `prisma/generated/` inside the
  project, not into `node_modules`. It is gitignored, so `postinstall` runs
  `prisma generate` — without that a fresh clone or a deploy would build
  against a client that does not exist.
- **Connection strings moved out of the schema into `prisma.config.ts`.** The
  `datasource` block carries no `url` at all.

**Why `prisma.config.ts` loads dotenv explicitly.** Prisma 7 stopped reading
`.env` files on its own, and this project keeps secrets in `.env.local`
following Next.js rather than `.env`. So the config calls
`loadEnvFile({ path: ".env.local" })`. Skip that and the CLI reports a missing
`DATABASE_URL` while the dev server starts perfectly, which is a confusing pair
of symptoms to debug. Note this is CLI-only; application code reads the URL
through `env.ts` like every other variable.

**`DATABASE_URL` is validated for a `postgres://` scheme**, not merely for
being non-empty. The realistic mistake is pasting the Prisma console's browser
URL instead of the connection string, and that fails much later with a far less
obvious error.

**Where it lives.** `features/database/prisma.ts` exports the one client, cached
on `globalThis` in development so Next's hot reload does not leak a connection
pool per edit until Postgres refuses new connections.

**Verified**, not assumed: `prisma generate` succeeds, `SELECT 1;` via
`prisma db execute` returns cleanly against the real Prisma Postgres instance,
and typecheck, lint, and `next build` all pass.

No migration has been run. `prisma migrate dev` is the first act of the schema
decision, not part of this step.

### 4. Design & look

A coffee or dark brown background, warm, not neutral gray or true black. One accent color, rust, used only for things you interact with, buttons, links, focus states, the win-rate bar, never as decoration. Because the background and the accent are both warm tones from the same family, the accent has to stay clearly brighter and more saturated than the background, enough that a button never blends into the page behind it, that's a real risk with two warm colors this close and worth checking by eye, not just by the numbers. Blue, indigo, and purple are never the accent, under any circumstance. Green is reserved only for marking a winner, red only for errors, never reused for anything else. Contrast should genuinely hold up in both light and dark mode, not just look fine at a glance.

- [ ] Decide the approach
- [ ] Build it

## Slice 1: Core arena loop

### 5. Model picker

An "Add model" popover pulling OpenRouter's live free-tier list, sorted by context window, capped at three models, defaulting to all three selected, with removable chips next to the prompt box. Also render that same catalog as a simple `/models` page, name, context window, and pricing for each one, so anyone can browse the full list without opening the picker.

- [ ] Decide the approach
- [ ] Build it

### 6. Send a prompt, parallel streams, and voting

The heart of the product. One prompt goes to every selected model at once, each streaming and failing independently, so one being slow or down never blocks the others. Each answer shows its own real time-to-first-token, tokens per second, and total tokens. No cost shown, every model here is free tier, so it would always read zero. A vote only exists once two or more models have answered, and picking one writes exactly one vote and marks that answer as the winner, while every answer stays visible the whole time. A follow-up continues each model's own separate conversation.

Arcjet sits in front of this endpoint before any model is ever called: rate limiting, bot protection, and a shield, plus a real limit on how much one person can use across all three models at once, not just a limit on the endpoint overall. **This part is built already** — see below.

Every prompt sent, every answer finishing, and every vote cast should be tracked as a real PostHog event, so there's an honest funnel from prompt to answer to vote. A model failing should also be logged properly on the server, not just shown to the user and forgotten. Separately from that funnel, every actual model call should also be wrapped so PostHog captures its own real tokens, cost, and latency per call, that's PostHog's own LLM analytics, not the same thing as the funnel events or the numbers already shown on the response card.

- [ ] Decide the approach
- [ ] Build it
- [x] Arcjet in front of `/api/chat` (pulled forward, see below)

#### Arcjet, built ahead of schedule

Built out of order, on request, while the rest of feature 6 is still open. The
endpoint it protects already exists and already spends real money upstream, so
there was no reason to leave it open until the voting UI catches up. Everything
else in feature 6 — parallel streams, voting, PostHog — is untouched.

**Where it lives.** `features/security/arcjet.ts` holds the client and the
decision-to-sentence mapping; [app/api/chat/route.ts](../app/api/chat/route.ts)
calls `protect()` inside the handler, immediately after the Clerk check and
before the body is even parsed. Not in `proxy.ts` — that is Clerk's, it runs on
every asset path, and Arcjet's own guidance is explicit that `protect()` belongs
in the route handler so different routes can carry different rules.

**Keyed by the Clerk user id, not by IP.** This is the load-bearing decision.
One arena prompt is three parallel POSTs by design, so an IP-keyed limit would
count a single prompt as three unrelated hits and would punish everyone behind a
shared network. Keying on the authenticated, server-resolved user id is what
makes this "a limit on how much one person can use across all three models at
once" rather than a limit on the endpoint. It also cannot be spoofed: the id
comes from Clerk on the server, never from a request header.

**Three rules, none redundant.**

- `shield` — the WAF. Zero config, no per-request cost, catches ordinary
  SQLi/XSS probing. No reason not to.
- `detectBot` — denies scripted clients before OpenRouter is called. Every bot
  denied here is an upstream call that never happens. `CURL` and `POSTMAN` are
  explicitly allowed: hand-verification through them is the only test path this
  project has, and denying them would break the standing no-test-runner
  decision. The route requires a Clerk session anyway, so an anonymous scraper
  gets a 401 before it ever reaches this rule.
- `tokenBucket` — capacity 30, refill 15 per 60s, one model call spends one
  token. Sized in model calls rather than prompts, because a prompt is three
  calls: ten three-model prompts back to back, five a minute sustained.

**`detectPromptInjection` was deliberately left out, and that contradicts the
paragraph above as it was originally written** ("a shield against prompt
injection"). That wording has been corrected rather than worked around. The rule
reads like an obvious fit for an LLM endpoint and is not one here: the app has no
agent, no tools, and no privileged context a prompt could hijack — the text goes
straight to a model the user chose. Comparing how three models handle a jailbreak
attempt is a legitimate, interesting thing to want the arena for, so blocking it
would refuse exactly the prompts people most want compared. If tool calls are
ever added, the calculus changes and the rule returns at the tool call site as a
guard, not here.

**Failure behaviour.** A denial never surfaces an Arcjet reason object or a rule
name. Rate limit → 429 with a sentence carrying the real seconds to wait; bot and
shield → a shared 403, because naming the rule that caught someone helps an
attacker and tells a real user nothing. `decision.isErrored()` is logged and
allowed through — the arena going down because its rate limiter went down would
be the worse outcome.

**`ARCJET_KEY` is in `env.ts`'s schema**, validated as starting with `ajkey_`, so
a missing or wrong key kills the process at boot instead of leaving the endpoint
that spends money running wide open. Site `llm-arena` on the Personal team.

#### Verified by hand

Dev server, real Clerk session token minted off the Backend API, no test runner:

- Unauthenticated `POST /api/chat` → 401, before any rule runs.
- 35 authenticated sends in a burst → 400 through send 30, then 429 from send 31.
  Exactly the configured capacity.
- The 429 body reads "You've sent a lot of prompts in a short time. Try again in
  55 seconds." — a real number off the decision, not a guess.
- Waited a minute, sent again → allowed. The bucket genuinely refills.
- `python-requests/2.31.0` and `Scrapy/2.11` User-Agents → 403, *while the bucket
  was already empty*, confirming bot detection is evaluated before the rate limit.
- curl itself was allowed throughout, which is what made all of the above
  testable.
- Decisions confirmed recorded in the Arcjet platform via
  `arcjet requests list --site-id site_01kzw136are5stgzmx5d71ff91` — a mix of
  `CONCLUSION_DENY` / `REASON_RATE_LIMIT`, `CONCLUSION_DENY` / `REASON_BOT_V2`,
  and allows.
- `tsc --noEmit`, `pnpm lint`, and `pnpm build` all clean.

One thing got fixed during verification: the first version read `resetTime` off
the rate limit reason, which is optional and which a token bucket decision does
not actually populate, so every 429 fell back to the vague "give it a minute"
sentence. `reset`, seconds-until-reset, is always there. Caught only because the
429 was actually triggered and the body actually read.

## Verification run — 2026-08-12

A full re-verification pass across the foundation, against the real dev server,
the real Clerk instance, real OpenRouter models, and the real Arcjet site. Five
things were asked for; three were verifiable and two are blocked on work that
has not been done yet. Recorded here rather than in a reply so the next
conversation does not repeat it.

### Green: typecheck, lint, build

All three clean — but only after a fix. `pnpm build` and `tsc --noEmit` were
both failing on a single error:

```
lib/prisma.ts(1,30): error TS2307: Cannot find module '../app/generated/prisma/client'
```

`lib/prisma.ts` is a second Prisma client, left over from an earlier hand-setup
before `features/database/prisma.ts` landed. Its import pointed at
`app/generated/prisma/client`, a path that does not exist — the generator writes
to `prisma/generated/`. Nothing in the repo imports it. It was never committed.

The file was deleted and the now-empty `lib/` folder went with it.
`features/database/prisma.ts` is once again the only Prisma client, which is
what it says it is ("import this, never construct a client anywhere else") and
what folder-by-feature requires. The duplicate was worse in four specific ways
and none of them are worth keeping around: it read `process.env.DATABASE_URL!`
instead of the validated `env.DATABASE_URL`, it was not marked `server-only`,
it cached on `global` in production as well as development, and its import path
was broken.

The import was briefly repointed at `prisma/generated/client` first, to get the
build green without deleting anything. That is not the state on disk — the file
is gone.

### Green: a real prompt reaches a real model with true metrics

Three real free models, authenticated with a real Clerk session token minted off
the Backend API, same prompt to each:

| Model | TTFT | Tokens/sec | Output tokens | Total |
| --- | --- | --- | --- | --- |
| `inclusionai/ling-3.0-tiny:free` | 1314ms | 421.2 | 342 | 2126ms |
| `nvidia/nemotron-3.5-lightning:free` | 678ms | 134.5 | 804 | 6657ms |
| `google/gemma-4-26b-a4b-it:free` | — | — | — | failed, see below |

Plausible, clearly different per model, and the numbers arrive on the `finish`
metadata frame exactly as the collection describes. The tokens/sec correction
from feature 1 is holding — no more four-figure rates.

The third model failing was not staged, and it exercised the error path for
real. The user-facing stream carried only `"That model didn't answer. You can
try it again."` while the server log carried the whole truth:

```
[chat] model google/gemma-4-26b-a4b-it:free failed AI_RetryError: Failed after 3
attempts. Last error: AI_APICallError: [Darkbloom] ... is temporarily
rate-limited upstream.
```

That is the rule working: real exception server-side, plain sentence to the
user, nothing leaked.

### Green: Clerk gate and Arcjet rules

- Unauthenticated `POST /api/chat` → 401 and a plain sentence, before any rule.
- `python-requests/2.31.0` and `Scrapy/2.11` User-Agents → 403 with the shared
  blocked sentence. No rule name, no Arcjet reason object.
- curl allowed throughout, confirming the `allow: ["CURL", "POSTMAN"]` list is
  what keeps hand-verification possible.
- Rate limit → 429 reading "You've sent a lot of prompts in a short time. Try
  again in 56 seconds." A real number off the decision.
- Every decision confirmed in the Arcjet platform via
  `pnpm dlx @arcjet/cli requests list --site-id site_01kzw136are5stgzmx5d71ff91`.

Two behaviours turned up that the earlier Arcjet verification did not record,
and both change how this endpoint has to be tested from now on.

**Bot detection is sticky, and it poisons a rate-limit test.** After the two
spoofed bot User-Agents were denied, *every* subsequent request from the same
client — plain curl, no spoofing — came back `CONCLUSION_DENY` /
`REASON_BOT_V2` for roughly two to three minutes before decaying back to allow.
`BOT_V2` is evidently doing client reputation, not just User-Agent matching. A
35-request burst fired immediately after the bot test returned 35 × 403 and
never reached the token bucket at all, which reads exactly like a broken rate
limiter and is not one. **Test bots and test the rate limit in separate runs,
with a few minutes between them.**

**The token bucket is eventually consistent, so it does not deny on the exact
request that crosses capacity.** A clean burst of 40 returned 40 × 400 — every
one allowed by Arcjet, bucket visibly overrun. A second burst of 40 fired
immediately after opened with 20 × 429. So the spend is bounded, just not at the
precise boundary under a fast local burst; the denials land a beat late. The
earlier "400 through send 30, then 429 from send 31" note was a run that started
against an already-partly-spent bucket, and reads as more precise than the rule
actually is.

That second burst also produced the cleanest evidence the configuration is real:
requests 21 through 35 were allowed mid-burst — **exactly 15**, matching
`refillRate: 15` over `interval: "60s"` — and then 429s resumed.

Not verified, for lack of a second account: that the bucket is genuinely keyed
per user rather than per IP. The `characteristics: ["userId"]` config says so and
the code passes a server-resolved Clerk id, but it has not been proven by
observation.

### Blocked: the first Prisma migration

**There is nothing to migrate.** `prisma/schema.prisma` holds a generator and a
datasource and zero models, and `prisma/migrations/` does not exist. Creating a
first migration means designing the data model — users, threads, per-model
messages, votes — which is feature 3's still-open "Decide the approach" step,
carrying two questions parked there on purpose: the vote-requires-two-answers
constraint, and the turn-creation race from three parallel POSTs. Inventing a
schema inside a verification pass would settle both by accident. The connection
itself is already proven (see "Prisma is connected"); it is only the schema
that is missing.

### Blocked: PostHog events

**PostHog is still not wired**, exactly as feature 1 already records. What
exists is only the surrounding scaffolding: `NEXT_PUBLIC_POSTHOG_KEY` and
`NEXT_PUBLIC_POSTHOG_HOST` are set and validated in `env.ts`, and
`@posthog/next`, `posthog-js`, and `posthog-node` are installed. What does not
exist is any provider in `app/layout.tsx`, any client instrumentation, or a
single capture call — the only match for "posthog" in the source is a comment in
`app/api/chat/route.ts` saying it arrives with feature 6. There are no events to
confirm receipt of. This is feature 6 work, undecided and unbuilt.

### Also noticed

- **Clerk session tokens are 60 seconds by default, and the collection already
  handles it.** This was first written up here as the collection lying about a
  15-minute lifetime. It is not: request 3, "Mint a session token", already
  sends `{"expires_in_seconds": 900}`, and that genuinely produces a 900-second
  token. The 60-second tokens seen during this run came from the throwaway curl
  harness used for verification, which posted `{}` and therefore got Clerk's
  default. Confirmed against the real API by decoding `exp - iat`: `{}` → 60,
  `{"expires_in_seconds": 900}` → 900. Nothing to fix. Recorded because anyone
  scripting the mint outside Postman will hit the same 60-second default and
  should copy the collection's body rather than the shape of the URL alone.
- `POST /v1/sessions/{id}/tokens` on the Clerk Backend API rejects a request
  with no body: it needs `Content-Type: application/json` and at least `{}`,
  otherwise it returns `unsupported_content_type`.

## Slice 2: App shell & thread history

### 7. App shell & thread history

The frame everything else sits inside: a top bar and sidebar that stay in place while the page scrolls, the thread's name, and each model's win record shown right there (shrinking down to a small dot and number if it gets crowded). The sidebar lists a signed-in user's own past threads so the tool actually feels usable across visits, not just in one sitting.

- [ ] Decide the approach
- [ ] Build it

## Slice 3: Public visibility & sharing

### 8. Public thread visibility & sharing

Anyone should be able to open a thread's link and see it, without an account, that's what actually makes it shareable. Only sending a prompt and voting need sign-in. A made-up or deleted thread just shows a plain not-found page either way. The thread's real owner sees everything everyone else sees, plus the ability to actually use it.

- [ ] Decide the approach
- [ ] Build it

## Slice 4: Leaderboard

### 9. Leaderboard: global & personal

Two leaderboards from the same votes, one for everyone, one just for the signed-in user. Each row's win rate is the big, bold number, in the accent color, with a small bar next to it, always written as "won 4 of 5," never a bare percentage or a made-up score. Smaller, quieter numbers underneath for average speed and time-to-first-token, each clearly labeled. No cost or "cheapest" stat, every model is free, so that number never means anything here. First place gets a subtle highlight, nobody else does.

- [ ] Decide the approach
- [ ] Build it

## Not doing right now

Kept here so the plan stays honest about what's deliberately left out.

- A "fastest" label on the leaderboard, tagging whichever model already has the best average speed, only for models with enough votes to mean anything. Nice to have, not required.
- Giving each model's own little icon a distinct look instead of plain gray. Nice to have, not required.
- Privacy policy and terms pages.
- Rich link previews when a thread gets shared somewhere.
- Any kind of admin or moderation page.
- A public API for the leaderboard data. Nobody's asked for this.
