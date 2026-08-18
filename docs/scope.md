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
| 2   | Coding standards & tooling                  | Foundation | done        |
| 3   | Data model                                  | Foundation | done        |
| 4   | Design & look                               | Foundation | done        |
| 5   | Model picker                                | Slice 1    | not started |
| 6   | Send a prompt, parallel streams, and voting | Slice 1    | not started |
| 7   | App shell & thread history                  | Slice 2    | UI built    |
| 8   | Public thread visibility & sharing          | Slice 3    | not started |
| 9   | Leaderboard: global & personal              | Slice 4    | not started |
| 10  | Bring your own key                          | Slice 5    | decided     |

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
  22,000 tokens/sec. Cause: the clock started at the first _text_ token, but
  several free models are reasoning models that think for seconds first, and
  the provider counts those reasoning tokens in `outputTokens`. A full token
  count was being divided by a partial window. The clock now starts at the
  first content chunk of any kind. A provider that returns everything in one
  chunk reports no rate at all rather than an invented one — there is genuinely
  nothing to measure there.
- **The model id was accepted unchecked,** as any nonempty string, and passed
  straight to OpenRouter. A signed-in caller could therefore post a _paid_ model
  id and spend this app's credits on a model outside the free-tier catalog the
  arena is built around. Fixed by `features/models/model-id.ts`: an id must now
  match `author/slug:free`, the suffix OpenRouter uses to mark the free variant,
  and a paid id is rejected with the same 400 and plain sentence as any other
  bad body — before the provider is called. This is a shape check, not a catalog
  check; feature 5's live free-tier list should also be checked against once it
  exists, and until then an unknown-but-free id still fails at call time as a
  handled provider error.
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

- [x] Decide the approach
- [x] Install lint, format, and whatever else is needed, and write it up in a coding-standards doc

#### What was decided

The conventions themselves live in [docs/coding-standards.md](./coding-standards.md),
which is the document someone actually reads. This section records why the
tooling around them is shaped the way it is.

**Prettier for formatting, ESLint for correctness, no overlap.** Biome was the
real alternative — one tool instead of two, and faster. It was rejected because
`eslint-config-next` carries Next 16's own rules and Biome has no equivalent for
them. Giving those up to save a second of lint time is a bad trade on a project
this size. No stylistic ESLint rules exist as a result; formatting is not a
thing anyone argues about here.

**ESLint rules mirror `CLAUDE.md` one-for-one, and nothing else.** Not a large
community preset. Every rule in `eslint.config.mjs` maps to a written rule: `any`
is an error rather than the Next preset's warning, `prefer-const` / `no-var` /
`no-param-reassign` hold the immutability line, and two `no-restricted-imports`
groups make folder-by-feature enforced rather than aspirational — a relative
import climbing into another feature fails, and so does reaching into another
feature's subfolder. Importing `@/prisma/generated/*` directly is also an error,
which is specifically what stops the duplicate Prisma client that had to be
deleted during the 2026-08-12 verification run from coming back.

**`eslint-plugin-functional` was deliberately left out**, even though the
functional-style rule is real. It fights React hooks and the Prisma client hard
enough that it would be switched off within a week, and a rule everyone disables
is worse than a written convention everyone reads. `map`/`filter`/`reduce` over
mutating loops, and `readonly` where it belongs, are held by review.

**`console.log` is a lint error**, `console.error` and `console.warn` are not.
This is a server that logs provider failures while showing the user a plain
sentence, and the way detail goes missing is logging an error at info level.
Root-level config files are exempt.

**`noUncheckedIndexedAccess` is on.** Indexing produces `T | undefined`, which is
the truth in an app made of streamed chunks and provider usage objects. It
turned up zero existing errors, so it cost nothing to adopt now and would have
cost real work later.

**Hooks are split by speed.** Pre-commit runs `lint-staged` — `eslint --fix` then
`prettier --write`, staged files only, well under a second. Pre-push runs the
whole `pnpm check`. A type error genuinely cannot be caught from staged files
alone, since changing one file can break the type of another that was not
staged, so that check has to be whole-project and therefore has to be rarer. The
alternative, typecheck on every commit, was considered and rejected: several
seconds per commit is exactly how a hook earns a habit of `--no-verify`.

**`pnpm check` is the single command** — `format:check`, then `lint`, then
`typecheck`. `pnpm build` stays out of it on purpose; folding a full Next build
in would make the cheap gate expensive enough that people stop running it.

#### Found while building

- **`core.autocrlf=true` with no `.gitattributes` was a live trap.** Git's
  Windows default checks every file out as CRLF while Prettier writes LF, so a
  fresh clone would fail `pnpm format:check` on every file in the repo — which
  reads as a broken tool and is really a line-ending mismatch. Fixed by adding
  `.gitattributes` with `* text=auto eol=lf`. Not part of the original plan;
  found because the first format pass produced CRLF warnings on 25 files.
- **The first format pass reformatted things it had no business touching** —
  the vendored agent skills under `.claude/skills/` and `.agents/skills/`, whose
  upstream hashes are recorded in `skills-lock.json` and which would have read as
  locally modified forever after, and the Excalidraw sketches in
  `docs/ui-sketch/`, whose markdown encoding Excalidraw owns. Both are now in
  `.prettierignore` with the reason written next to them. `AGENTS.md` is ignored
  too, since `next dev` rewrites it.

#### Corrected in review

The feature-boundary rules were reviewed and only about half enforced what they
claimed. A comment flagged that `@/features/<other>/internal/helper` slipped
through; that specific case turned out to fire correctly, but probing every
combination rather than only the one raised found four real holes:

- **A later config object replaces `no-restricted-imports`, it does not merge
  with it.** The per-feature blocks listed only their own patterns, so every file
  under `features/` silently lost the project-wide rules — the climb-out ban and
  the generated-Prisma-client ban did not apply to the code most likely to break
  them. The shared patterns are now spliced into each per-feature block on
  purpose, with a comment saying why.
- **A sibling feature reached relatively was caught by nothing.**
  `../models/openrouter` from inside `features/chat` crosses a feature boundary
  without looking like it climbs out.
- **Climb-out patterns were listed at two depths only**, so `../features/...`
  from `app/` passed. Depths are now spelled out 1 through 4, deliberately not
  written as one glob with a leading `**` — that would also match the
  `@/features/...` form the rule exists to push people toward.
- **`@/prisma/generated/*` missed nested paths**, now `@/prisma/generated/**`.
  Tightening it immediately caught `features/database/prisma.ts` itself, which is
  the one file that legitimately constructs the client, so it is exempted by
  name — an exemption that only became necessary once the merge bug above was
  fixed and the rule started applying there at all.

#### Verified by hand

No test runner, as decided:

- A probe file containing `any`, an unused variable, and `console.log` was
  linted: all three rules fired with the intended messages. File deleted.
- A probe matrix of fifteen import specifiers across `app/`, a feature root, and
  a folder one level inside a feature: all ten that should be rejected fired
  with the intended message, and the five legitimate ones — a top-level import
  of another feature through `@/`, two same-folder imports, an intra-feature
  climb, and `features/database/prisma.ts` importing the generated client —
  stayed clean. A sibling file in that same folder importing the generated
  client still fails, so the exemption is scoped to the one file rather than the
  folder. Probes deleted.
- That same file staged and committed: the pre-commit hook **rejected** the
  commit and restored the working tree untouched.
- A formatting-only file staged and committed: the hook **fixed and committed the
  formatted version** — `git show` confirmed the committed content was the
  reformatted one, not what was staged. Probe commit removed afterwards.
- `pnpm check` (format, lint, typecheck) and `pnpm build` both clean.

- Pre-push fired on the real `git push` that opened the pull request for this
  work: the full `pnpm check` ran ahead of the upload, and the push only
  completed after it passed.

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
- [x] Decide the approach
- [x] Write the schema and run the first migration, proven against the live database
- [x] Build the write paths: `POST /api/turns`, `POST /api/votes`, and persistence
      inside `/api/chat`
- [x] Add all three routes to the Postman collection, happy path and failures

#### What was decided

The shape is `User → Thread → Turn → ModelResponse`, with `Vote` hanging off a
`Turn`. Five models and one enum, in `prisma/schema.prisma`, which carries the
same reasoning inline as doc comments so it is readable next to the fields it
explains.

**A turn holds its prompt as a field; there is no message table with a role
column.** Every model in a turn answers the same text, so storing it once is
what makes "two or more models answered this" a countable thing rather than a
join to reason about. One model's own conversation, which feature 6's follow-ups
need, is the thread's turns in `index` order, each turn's prompt paired with that
model's response. A model that failed a turn contributes nothing to its own
history, which is the right behaviour and falls out of the shape for free rather
than needing a rule.

**The turn-creation race from feature 1 is solved by creating everything up
front.** A new `POST /api/turns` creates the thread if it is new, the turn, and
one `PENDING` `ModelResponse` per selected model — all in one transaction — and
returns the ids. The three parallel `/api/chat` calls each carry their own
`modelResponseId` and only ever update that one row. Nothing races because
nothing concurrent creates anything. The alternative parked in feature 1,
resolving a client-generated turn id idempotently across three calls, would have
put concurrency handling in the hot streaming path to save one round trip.

**The vote rule is enforced in two places, deliberately.** The database holds
what it can express declaratively: `@@unique([turnId, userId])` for one vote per
person per turn, and a composite foreign key from `Vote(modelResponseId, turnId)`
to `ModelResponse(id, turnId)` so a vote cannot point at a response from a
different turn. That second one needs `@@unique([id, turnId])` on
`ModelResponse`, which exists for no other purpose.

The "two or more models actually answered" half stays in application code, inside
the same transaction as the insert. Postgres cannot express a count over a
related table in a `CHECK`, so the database-side options were a `BEFORE INSERT`
trigger — raw SQL that Prisma does not model, invisible in the schema file, easy
to lose on a reset — or a denormalized counter on `Turn` with a generated
`votable` column and a composite key hung off it, which is fully declarative and
still bottoms out on the app maintaining the counter. That moves the trust
rather than removing it, and buys nothing when the only writer is one route in
this app.

The check is safe outside the database for a specific reason worth not
rediscovering: `ResponseStatus` only moves one way. A response goes
`PENDING → COMPLETE` or `PENDING → FAILED` once and never back, so the count of
completed responses rises and never falls. The usual check-then-write hazard
therefore cannot bite in the dangerous direction — the worst case is refusing a
vote a few milliseconds before the second answer lands, on a turn whose UI has
not rendered a second answer yet either.

**No Clerk webhook; `User` rows are upserted lazily.** Clerk stays the source of
truth for who someone is and the table holds nothing Clerk already holds — it
exists so threads and votes have real referential integrity and the personal
leaderboard is a join rather than a string filter. `upsertUser(clerkUserId)` runs
as the first statement inside the `POST /api/turns` and `POST /api/votes`
transactions, never as its own round trip, so a failed turn cannot leave an
orphan user behind. A webhook would have needed signature verification, a
backfill for anyone who signed up first, and would still race a thread write that
arrives before `user.created` does. The table is shaped so a webhook can be added
later to fill in a display name without a migration that touches foreign keys.

**`modelId` and `modelName` are both stored, and they are different kinds of
thing.** `modelId` is the stable `author/slug:free` key and is what the
leaderboard groups by. `modelName` is a snapshot of the display name as it stood
when that call was made, because feature 5's catalog is live: a model that gets
renamed, or drops off the free tier, would otherwise leave a months-old thread
and a leaderboard row with nothing to call themselves. The leaderboard groups by
`modelId` and takes the most recent name it saw for that id. The name is
caller-supplied, only ever displayed, and never trusted for logic — which is why
`POST /api/turns` will take `models: [{ id, name }]` rather than a bare list of
ids, with `id` still validated against `freeModelIdSchema`.

**Token accounting stores input, output, and total separately.** Total is not
reliably input plus output — reasoning and cached-input tokens land in a
provider's total differently, and that is the same seam that made tokens/sec read
in the thousands before feature 1 corrected it. All three are recorded as
reported rather than recomputed. `costUsd` is `Decimal(12,6)`, always reads
`0.000000` because every model here is free tier, and is stored anyway because it
is a real measured number; a cost with no input token count beside it could never
be audited.

**No column stores a provider's error text.** A failed call is `FAILED` and the
real exception goes to the server log. Keeping it out of a table the UI reads is
how it stays out of the UI. `STREAMING` is likewise not a status — that state
lives in the browser and never needs to survive a refresh.

**No visibility flag on `Thread`.** Feature 8 makes every thread readable by
link; only writing to one requires being the owner, which is an ownership check
in a route, not a column.

#### The write paths

Three routes, and one shared preamble. `POST /api/turns` creates the thread (if
new), the turn, and one PENDING `ModelResponse` per model in a single
transaction; `POST /api/chat` claims one of those rows and fills it in;
`POST /api/votes` runs the ≥2 check and writes the vote. Domain logic lives in
`features/turns/`, `features/votes/`, `features/chat/persist-response.ts` and
`features/users/upsert-user.ts` as functions returning a discriminated result;
the route handlers only map those results onto a status and a sentence.

**`features/security/guard.ts` exists because three routes now share the same
three steps** — require a Clerk session, ask Arcjet, hand back a trusted user id.
Copy-pasting that into a third handler is how one of them eventually stops
agreeing with the others. The order inside it is deliberate: Clerk first so an
anonymous caller costs nothing and never reaches a rule, Arcjet before the body
is read, and the user id resolved server-side so a per-user limit cannot be
sidestepped with a header. `features/http/plain-response.ts` does the same job
for the refusal shape.

**`/api/chat` no longer accepts a model id, and that is a security fix, not a
tidy-up.** The request now names a `modelResponseId` and the server reads the
model back off that row. The old shape let a caller pair a legitimate response id
with a _different_ model — the id was validated for the `:free` suffix but never
checked against the row it was filling in. The free-tier check therefore moved to
`POST /api/turns`, which is now the only place a model id enters the system.
The Postman collection's "Paid model → 400" request moved with it.

**Claiming is guarded three ways** before the provider is called: the row must
exist, its thread must belong to the caller, and it must still be PENDING. The
last one matters more than it looks — without it a completed row could be re-run
indefinitely, each run spending a real upstream call and overwriting a real
measurement, which would quietly corrupt the leaderboard's speed numbers.

**The two write routes carry no token-bucket cost.** Shield and bot detection
only. The bucket on `/api/chat` is sized in model calls because that is what
spends money; charging a turn or a vote against it would change what the number
means, and "30" would stop being "ten three-model prompts".

#### Found while building

- **The stopwatch could be read twice and gave two different answers.** A call is
  now read once for the stream's finish frame and once to write the row,
  milliseconds apart, and the browser and the database disagreed about the same
  request: 179.8 tokens/sec on screen against 179.6 stored. Neither number was
  wrong, which is exactly what made it insidious — it would have shown up much
  later as a leaderboard that never quite matched what people remembered seeing.
  `createCallTimer` now caches its first read and returns it forever after.
  Confirmed fixed by observation: the stream and the row now report identical
  numbers on every model.
- **Prisma's default 2-second `maxWait` was too short for a cold start, and it
  returned a 500.** The first `POST /api/turns` against a freshly started server
  failed with "Unable to start a transaction in the given time"; the identical
  request a moment later succeeded. Timed it rather than guessing: the first
  transaction takes **11 seconds** — TCP connect plus a TLS handshake to the
  remote pooled Postgres — against 0.5s warm. Left alone that is a 500 on the
  first prompt after every deploy and every serverless cold start, which is the
  worst possible moment for one. `TRANSACTION_OPTIONS` in
  `features/database/prisma.ts` raises `maxWait` to 15s and `timeout` to 20s, and
  both transactions use it. Sized for a slow network, not slow queries.
- **A repeated model id in one turn would have been a 500.** The database refuses
  it with `@@unique([turnId, modelId])`, correctly, but a unique violation
  surfacing as a server error is the wrong answer to what is plainly a bad
  request. Caught in the Zod schema now and reported as a 400.

#### Corrected in review

Four findings, all valid, all fixed. Two of them shared a root cause: there was
no way for a call to _reserve_ a response row, only to check it.

- **Claiming a response was not atomic.** `claimResponse` read the row, saw
  PENDING, and then called the provider. Two overlapping requests for the same
  owned id both passed that check, both spent an upstream call, and both wrote an
  answer — the slower one silently overwriting the faster one's content and
  metrics. Nothing in the old code reserved anything; the terminal writes updated
  by row id alone. Fixed by making the status check a conditional update rather
  than a read: `updateMany` moves the row to a new `STREAMING` status, and
  `count` decides the winner. Exactly one concurrent caller can match. Terminal
  writes are also conditioned on the reservation still being the caller's, using
  `startedAt` as the lease's identity, so a call whose reservation expired cannot
  come back and clobber whoever took over.
- **A failed response could never be retried.** FAILED was terminal, so a
  transient upstream rate-limit — which free models produce constantly — cost that
  model its slot in the turn permanently, while the UI advertised a retry that
  could only ever return 409. FAILED is now claimable again. COMPLETE stays
  terminal, which is the part that matters: the vote rule's safety argument
  depends on the count of completed answers never falling, and nothing ever
  leaves COMPLETE. The "status only moves one way" note written above during the
  build was too strong, and has been corrected here and in the schema rather than
  left to mislead.
- **Reservations expire.** Introducing STREAMING introduced a way to strand a
  row: a stream killed mid-flight never reaches `onFinish` or `onError`, and
  without an expiry that row would sit reserved forever, unanswerable and
  unretryable. A reservation is honoured for 120s — comfortably past the route's
  own 60s `maxDuration`, so a slow-but-alive call is never stolen from under
  itself — after which another call may take it over.
- **Messages bypassed the stored prompt.** A caller holding a legitimate pending
  response id could send entirely different text. The model answered _that_, and
  the answer plus its speed numbers were then filed under the turn's canonical
  prompt — a quiet corruption of exactly the data this app exists to collect.
  The route now requires the final user message to equal the turn's prompt.
  Earlier messages are not checked and should not be: each model carries its own
  separate conversation, which the client legitimately owns and replays, and the
  server cannot reconstruct it. A rejection releases the reservation back to
  PENDING rather than FAILED — nothing was attempted, so the row must look
  untouched.
- **The first version of that prompt binding could still be bypassed.** It
  searched backwards for the most recent _user_ message, which meant a caller
  could send the turn's real prompt and then append a trailing _assistant_ turn.
  The prompt was present, so the check passed — while the model's actual final
  input was the injected text. Putting words in a model's mouth as a trailing
  assistant message is a well-known way to steer its answer, and the answer it
  produced would still have been filed under the turn's prompt with its speed
  numbers attached, which is the same corruption the binding was added to
  prevent, just through a narrower door. The check is now on the last message
  rather than the last user message: the conversation has to _end_ on the turn's
  prompt. That costs nothing, because a genuine turn always ends on the question
  being asked, and it was verified not to break a real follow-up.
- **And even that was still bypassable, which is what finally settled the
  shape.** With the prompt required to be the last message, a caller could still
  put entirely fabricated history in front of it — invented earlier questions,
  invented earlier answers — and all of it reached the model and shaped the
  answer, which was then stored against the canonical turn. There is no
  validating that away: the whole array is the caller's invention, so there is
  nothing to check it against.

  Except there is, and it had been sitting in this feature's own schema the whole
  time. `Turn.index`, `Turn.prompt` and `ModelResponse.content` **are** a
  per-model transcript — the "each model's own conversation is the thread's turns
  in index order" line written at the top of this feature is a description of a
  query. The comment justifying client-supplied history said "the server cannot
  reconstruct it", and that was simply false by the time it was written.

  So `/api/chat` stopped accepting history. `features/chat/conversation.ts`
  rebuilds it: every earlier turn's prompt paired with _this_ model's COMPLETE
  answer to it, in order, then the current turn's prompt. The body is now a
  `modelResponseId` and nothing else, and it is `.strict()`, so a stale client
  still posting `messages` gets a plain 400 rather than having its history
  silently ignored — which would look like the server obeying it.

  The pattern is worth keeping in mind, because four rounds of review found the
  same bug four times: the model id could point at another row, then the prompt
  could differ from the turn's, then the prompt could be right but followed by a
  steering assistant turn, then the prompt could be right and last with invented
  history in front. Each fix validated one more field and the next probe found
  the next field. What ended it was not a better check but deleting the input —
  nothing from the browser is trusted now because nothing needs to be sent. When
  a validation rule needs tightening for the third time, the question is probably
  whether the field should exist.

- **The collection's "Unknown model" request had gone stale.** It still sent the
  old `modelId` field and omitted the now-required `modelResponseId`, so it was
  exercising body validation while claiming to exercise the provider-failure
  path. Exactly the way a collection starts lying about the API. Fixed, and three
  requests added for the behaviour above: the concurrent-claim 409, the retry of a
  FAILED row, and the prompt-mismatch 400.

#### Also fixed: the cold start, properly

The raised `maxWait` recorded above was the wrong shape of fix on its own. It
stopped the 500 but left the first prompt after every deploy waiting eleven
seconds for a TLS handshake, and it turned out not even to be reliable — a
client regenerated mid-session blew through 15s and returned a 500 again.
`instrumentation.ts` now opens the first connection at boot, before the server
accepts a request, so nobody ever pays for it. It is deliberately not fatal: a
database briefly unreachable at boot should not stop the server from serving the
pages that do not need it. `TRANSACTION_OPTIONS` keeps the raised timeout as a
backstop for when the warm-up was itself too slow or failed.

#### The fixes, verified by hand

Against the running dev server and the real database, all green:

- **Two genuinely simultaneous requests** for the same PENDING row, fired in
  parallel: one 200, one 409 "That model is already answering this prompt." The
  row afterwards holds exactly one answer.
- **A mismatched prompt** → 400, and the row reads PENDING with no reservation
  afterwards — released, not failed.
- **History is genuinely rebuilt server-side, proven by a model's own memory.**
  Turn 1: "My favorite color is burnt orange. Reply with just the word: noted."
  → the row stored `"noted"`. Turn 2, in the same thread, sending **no history
  at all**, only a response id: "What is my favorite color?" → the model answered
  `"burnt orange"`. It could only know that from the transcript the server
  assembled and sent, which is the whole claim, demonstrated rather than
  asserted.
- **A body carrying `messages`** — fabricated earlier questions and answers with
  the turn's genuine prompt last, the exact shape that defeated every previous
  version of the check → **400**, refused before anything else happens.
- **Re-answering a COMPLETE row** → 409. Still closed for good.
- **A genuinely nonexistent model** (`ghost/model-that-never-was:free`, which
  passes the `:free` shape check and cannot exist) → the stream carried only
  "That model didn't answer. You can try it again.", the row read FAILED, and
  nothing matching `openrouter`, `APICallError` or `RetryError` appeared anywhere
  in the response.
- **Retrying that FAILED row** → accepted and streamed. It fails again, being a
  fake model, but it is no longer locked out.
- **The first request after a cold boot** → 201, no timeout, with the warm-up in
  place.

The full 21-check route suite was re-run afterwards and still passes, so none of
this regressed the turn, vote, or streaming paths.

#### An unresolved contradiction — now resolved by feature 10

`CLAUDE.md` says cost will always read $0.0000 and to **show it anyway**, since
it is still a real, honestly measured number. Feature 6 below said **no cost
shown**, and feature 9 said no cost stat on the leaderboard. Those disagreed. The
column exists either way; the display question belonged to feature 6 and should
not have been settled silently by whichever screen got built first.

**Settled by feature 10.** Cost is shown on the response card, and stays off the
global leaderboard. Once a user can bring their own key, cost stops being a
constant — a free model reads `$0.000000` and a BYOK model reads a real nonzero
number, so the field carries information rather than repeating itself. The global
leaderboard excludes BYOK responses entirely, so a cost stat there really would
be a column of zeros, and stays out. See feature 10 below.

#### Verified by hand

The migration is `prisma/migrations/20260813032554_initial_data_model`. A
throwaway raw-SQL probe ran against the real Prisma Postgres instance — raw SQL
on purpose, since the point was what Postgres itself refuses, not what the Prisma
client refuses on the way there. It seeded two users, a thread, two turns, and
four responses, then deleted the users and confirmed the cascade emptied every
table. Probe deleted afterwards.

Allowed, as they should be:

- A vote from user A for a `COMPLETE` response on the same turn.
- A vote from user B on that same turn for a different response.

Refused by Postgres, each by the named constraint:

- The same user voting twice on one turn — `Vote_turnId_userId_key`.
- A winner belonging to a different turn — `Vote_modelResponseId_turnId_fkey`.
  This is the composite key earning its keep.
- Two responses for the same model in one turn — `ModelResponse_turnId_modelId_key`.
- Two turns claiming the same index in a thread — `Turn_threadId_index_key`.
- A thread owned by a nonexistent user — `Thread_userId_fkey`.
- A duplicate Clerk id — `User_clerkUserId_key`.
- A status outside the enum (`STREAMING` was the probe value) — `22P02`.

Also confirmed: `costUsd` defaults to `0.000000`, and the seeded turn reports
exactly 2 `COMPLETE` responses, which is the count the vote transaction will
read.

`pnpm check` (format, lint, typecheck) and `pnpm build` both clean.

#### The routes, verified by hand

A curl harness mirroring the Postman collection, against a running dev server,
the real Clerk instance, real free models, and the real database. **21 of 21
checks passed**, plus a separate 7-check cold-start run of the vote path.

`POST /api/turns` — a three-model turn (201, three PENDING rows), a follow-up
turn on the same thread landing at `index` 1, a one-model turn, a paid model
refused 400, the same model listed twice refused 400, four models refused 400, an
unknown thread 404, and unauthenticated 401.

`POST /api/chat` — two models streamed into their claimed rows, then re-answering
a COMPLETE row 409, an unknown response id 404, and a missing `modelResponseId` 400.

`POST /api/votes` — the whole rule, end to end:

- Voting before any model answered → 409.
- Voting for a response still PENDING, on a turn that is otherwise votable → 409.
  That is the status check in the transaction, not the foreign key, which would
  have accepted the row.
- A winner belonging to a different turn → 400.
- A one-model turn → 409, permanently.
- The real vote → 201.
- The same person voting again → 409, off the unique index.
- Unauthenticated → 401.

Read back from the database afterwards: two COMPLETE rows carrying real TTFT,
tokens/sec, input/output/total tokens and `costUsd` at `0.000000`, one row left
PENDING, the turn indexes in order, and exactly one `Vote` joined to the winning
model. The persisted numbers match what the stream reported, exactly.

**The failure path was exercised for real, not simulated.** During the first run
`inclusionai/ling-3.0-tiny:free` was rate-limited upstream. The row was marked
FAILED, the stream carried only "That model didn't answer. You can try it again.",
and the full provider exception went to the server log alone. It also meant that
turn only ever had one COMPLETE answer, so every vote on it was refused — the ≥2
rule doing exactly its job on an unplanned input, which is better evidence than
the staged case.

Not verified, for lack of a second Clerk account: the 403 paths — writing a turn
into someone else's thread, and claiming someone else's response row. Both are
`if` statements over a server-resolved id, both have Postman requests waiting
with the setup written down, but neither has been proven by observation.

`pnpm check` (format, lint, typecheck) and `pnpm build` clean, with `/api/turns`
and `/api/votes` both in the route manifest.

#### The Postman collection

Two new folders, `Turns` and `Votes`, and the `Chat` folder reworked around
`modelResponseId`. Every request carries a description saying what to expect and
why, and the capture scripts save `threadId`, `turnId` and the response ids
forward so the folders run in order — Turns, then Chat, then Votes. Scripts
capture variables only, never assert, and they use the same `save` helper as the
Setup folder so an active environment is written to rather than shadowed.

Two requests are deliberately manual: "Someone else's thread → 403" and
"Someone else's response → 403" need a second Clerk user, and say so.

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

_Since superseded: the schema decision has been made and the first migration is
applied. See "What was decided" and "Verified by hand" above._

### 4. Design & look

A coffee or dark brown background, warm, not neutral gray or true black. One accent color, rust, used only for things you interact with, buttons, links, focus states, the win-rate bar, never as decoration. Because the background and the accent are both warm tones from the same family, the accent has to stay clearly brighter and more saturated than the background, enough that a button never blends into the page behind it, that's a real risk with two warm colors this close and worth checking by eye, not just by the numbers. Blue, indigo, and purple are never the accent, under any circumstance. Green is reserved only for marking a winner, red only for errors, never reused for anything else. Contrast should genuinely hold up in both light and dark mode, not just look fine at a glance.

- [x] Decide the approach
- [x] Build it

#### What was decided

The rules above fix the palette's _intent_; this step fixed the actual values,
the typography, the one memorable element, and the wiring — so features 5 to 9
never write a color again.

**The subject is instrumentation, not chat.** This app's whole claim is honestly
measured numbers, so the design is shaped like a scoreboard: data set in a real
tabular mono and treated as the point, rather than as small gray caption text
under a chat bubble. That is what the typography and the signature element below
are both derived from.

**Every color is measured, not eyeballed.** The pairs, with their real ratios:

| Token            | Dark               | Light              |
| ---------------- | ------------------ | ------------------ |
| page             | `#1A1310`          | `#F5EDE4`          |
| card             | `#241A16`          | `#FFFBF6`          |
| text             | `#F2E7DF` (15.1:1) | `#2A1D17` (14.1:1) |
| muted text       | `#B29C90` (7.0:1)  | `#6E5A4E` (5.6:1)  |
| rust (`primary`) | `#E2662F` (5.4:1)  | `#B8481B` (4.6:1)  |
| winner           | `#5FA772` (6.3:1)  | `#2F6B44` (5.5:1)  |
| error            | `#E05A4E` (5.0:1)  | `#B3382C` (5.2:1)  |

The specific worry written into this feature — rust disappearing into brown,
two warm tones from one family — is the 5.4:1 line. It clears AA on its own, and
rust never appears as a flat fill against a bare background anyway: a button
carries dark ink _on_ rust, which is another 5.4:1.

**Token names follow shadcn's vocabulary rather than inventing a parallel one,
and the mapping that matters is `--primary` IS the rust accent.** The obvious
naming — calling our accent `--accent` — collides head-on with shadcn, where
`--accent` is a subtle hover surface that ghost and outline buttons fill with.
Two different meanings for one utility name would have meant either patching
every shadcn component or keeping a second palette beside the first. Reusing
`--primary` costs one paragraph of explanation in `globals.css` and buys a
single source of color for hand-written and vendored components alike.

**Archivo at two widths, JetBrains Mono for every number.** The `wdth` axis is
loaded explicitly in `layout.tsx`, so headings can run at 125% expanded — the
signage treatment — while body copy stays normal width. One family across both
roles, so headings and prose never look borrowed from different projects. The
serif-on-cream direction was deliberately avoided: it is the single most common
look an AI produces for a warm-background brief, and it says nothing about
measurement.

Three type roles exist as `@utility` classes rather than repeated class
clusters: `type-display` (signage), `type-eyebrow` (small structural labels),
and `type-metric` (every ms, tok/sec and token count, with tabular figures so a
column lines up and a streaming number does not jitter as its digits change).

**The signature element is the timing rail**, built as
`features/ui/timing-rail.tsx`. A hairline under a response card that fills as
the model streams, notched where first token landed, with every rail in a turn
drawn against one shared time axis — so a slow model is visibly short beside a
fast one. It is the speed numbers made watchable instead of read afterwards.
Rust while live, green once voted winner, red when the call failed, which is
exactly the three-color rule doing real work rather than decorating.

The component is pure and presentational: it takes fractions and renders them.
Measuring stays in `features/chat/call-metrics.ts` and deciding the shared axis
belongs to the turn, both feature 6's. It is `aria-hidden` on purpose — it
carries nothing that is not already beside it as text, and three simultaneous
progressbars announce constantly while saying nothing new.

**The logo is a Spartan helmet, and it is the one place the palette rules bend
toward nothing.** It replaced a rust `LA` lettermark. Supplied as artwork the
project owns, vectorised, then cut down: the trace arrived as three layers and
only one is used. A full-canvas white plate was the background of the image it
was traced from and had to go for the mark to be transparent at all. A red ring
around the helmet was dropped because red is reserved for errors here — a red
logo would mean red says two things, and every real error afterwards reads
slightly weaker. The helmet's own ten subpaths were cut to four; the other six
were hairline interior detail that turned the mark into a grey smudge below
about 24px. That was settled by rendering the candidates at 16, 20, 28 and 32px
and looking, not by judging them at full size.

The mark itself takes `currentColor` and is drawn in plain `foreground` — no
accent plate. Rust is for things you interact with, and a logo plate was
borrowing it as decoration. `app/icon.svg` is the one copy that carries its own
colors, because a browser loads it with no page around it: the coffee plate is
its own ground, so the cream helmet holds on a light or dark tab bar without a
`prefers-color-scheme` swap that would only make the tab harder to find again.
Two files, one drawing — `features/ui/brand-mark.tsx` and `app/icon.svg` change
together. Next's stock `app/favicon.ico` was deleted rather than left beside it,
so the browser is offered exactly one icon.

**The model mark carries the provider's logo, and it was promoted out of "Not
doing right now" because one letter was not doing the job.** That list used to
hold "giving each model's own little icon a distinct look"; it came out on
2026-08-18 when the single letter turned out to be failing at something more
basic than looking plain. Two models from one provider collide on it outright —
`Google: Gemma 4 26B` and `Google: Gemma 4 31B` both rendered a bare `G`, and in
the top bar's win chips the mark was the _only_ visible identifier, so the two
were genuinely indistinguishable.

So the fix is two halves, and the artwork is only one of them.

**The mark takes an id, not a hand-written letter.** `google/gemma-4-31b-it:free`
already names its author, so `modelAuthor()` reads it in `model-id.ts` beside the
schema that already defines that format. The `initial` field kept on all three
placeholder types is deleted — it was a second, hand-maintained copy of something
the id already said, and feature 5's live list would have had to invent a value
for it on every row.

**Four marks are vendored, not depended on.** `features/models/model-glyph.ts`
holds paths for Google, Mistral, NVIDIA and Qwen, copied from simple-icons
(CC0-1.0). The package is not a dependency: it ships some three thousand marks
for the four this app draws. Every one is rendered in `currentColor` at
`muted-foreground`, never in a brand color — Google's blue would put the one hue
this design forbids outright straight into the chrome, and a full-color logo
beside a rust button makes decoration louder than the accent reserved for things
you can click. The helmet above settled that for our own mark; a borrowed one
does not get a wider licence.

**The letter fallback is the common path, not the edge case.** simple-icons has
no InclusionAI, so it renders `I` today, and once feature 5 reads OpenRouter live
and feature 10 widens past the free tier, most authors will have no vendored
mark. A glyph is drawn bare at full size because a silhouette reads best with
nothing ringed around it; a letter keeps the ring, because a bare letter is not a
mark until something contains it. Same box either way, so a mixed row still
lines up.

**Known weak spot: NVIDIA's eye at 20px.** Checked by rendering, the way the
helmet was. At 28px on a card it reads; at 20px in a chip it closes into a
smudge — the same failure the helmet's hairline subpaths had. The helmet's fix
was to cut subpaths, which is not available here, since a simplified NVIDIA mark
stops being NVIDIA's mark. Kept anyway: at `md` it carries real information, and
at `sm` the model name now sits beside it so the mark is no longer identifying
anything on its own. If it ever reads as noise, deleting the `nvidia` entry
drops it to an `N` and nothing else changes.

**The top-bar chip gained the model's name, and no glyph could have replaced
it.** Both Gemmas draw the same Google mark, so art alone cannot separate them.
The chip shows `modelShortName()` — the model half of OpenRouter's
`Vendor: Model` string — because keeping `Google: ` would repeat what the mark
already says and then truncate away the `26B` that is the entire difference.
Below `lg` the name hides and the chip shrinks back to mark and number, which is
the crowding behaviour this feature already committed to.

**The `svg` is wrapped in a `span`, for the reason recorded below about
`SidebarMenuButton`.** `Badge` ends its class list with `[&>svg]:size-3`, and
`ModelMark` sits directly inside a `Badge` in both the top bar and the composer,
so a bare `svg` would have been pinned to 12px. The same trap, caught the second
time by having written it down the first time.

**Dark is not hard-coded as the default; the system is.** `next-themes` with
`attribute="class"`, so a first visit follows the machine and a toggle can then
disagree with it and be remembered. A media query alone could not do the second
half.

**Accessibility is applied once, in `globals.css`, not remembered per screen.**
A 2px rust `:focus-visible` outline at 2px offset, and a
`prefers-reduced-motion` block. shadcn's Button overrides the outline with its
own ring, so it was edited to match the baseline exactly rather than diverge —
see below.

#### Found while building

- **shadcn's Button shipped two accessibility problems, both fixed in place.**
  Its focus ring is 3px of `ring-ring/50` — rust at half opacity, which lands
  under 3:1 against the coffee ground. And its destructive variant hard-codes
  `text-white`, which is 3.66:1 on the dark-mode red; the
  `--destructive-foreground` token is 5.02:1. Both were found by measuring the
  vendored file rather than trusting it, and the reasons are written into the
  component next to the change.
- **`next-themes` logs a React 19 console error** — "Encountered a script tag
  while rendering React component" — because its no-flash script is rendered
  from inside a client component. A hand-rolled replacement was built and then
  reverted on request: the error is a dev-only warning and the provider stays.
  Recorded because it will show up again in the console and is not a bug in this
  app's code.
- **shadcn's `SidebarMenuButton` pins any direct `svg` child to 16px.** Its
  class list ends with `[&>svg]:size-4`, which outranks a size utility written
  on the element itself, so the logo silently rendered at 16px — the size where
  its interior detail stops reading. Two changes fix it: wrap the mark in a
  `span` so it is no longer a direct `svg` child, and give the header button
  `size="lg"`, which is the only size variant that drops padding in the
  collapsed rail (`group-data-[collapsible=icon]:p-0!`) and so leaves a full
  32px icon box. Worth knowing before adding any other non-lucide graphic to a
  sidebar row.
- **The ESLint `FEATURES` list was four features out of date.** It listed
  `auth, chat, database, models, security` while `http`, `turns`, `users` and
  `votes` had since been added — so the feature-boundary rules described in
  `docs/coding-standards.md` were silently not applying to any of them. Now
  complete, plus the two added here (`theme`, `ui`). Adding the missing four
  surfaced no existing violations, so nothing had actually gone wrong yet.

#### Verified by hand

Against the running dev server, no test runner:

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all clean,
  with all seven routes still in the manifest.
- `GET /` returns 200 and the served HTML carries the new type utilities.
- Both palettes are present in the served CSS — `--primary: #b8481b` under
  `:root` and `#e2662f` under `.dark` — along with `--winner` in both modes,
  `font-stretch: 125%` on `type-display`, all three type utilities, and the
  global `:focus-visible` outline in the base layer.
- Clerk's appearance is passed as `var(--…)` references, confirmed present in
  the server-rendered payload, so its modal follows the theme toggle rather than
  carrying a second palette.

**Not verified by machine, and it cannot be:** contrast by eye, the keyboard-only
pass, and that Clerk's components actually resolve `var()` colors rather than
falling back. This project has no browser automation by decision, so those are
genuine human checks — see the reply that accompanied this build.

## Slice 1: Core arena loop

### 5. Model picker

An "Add model" popover pulling OpenRouter's live free-tier list, sorted by context window, capped at three models, defaulting to all three selected, with removable chips next to the prompt box. Also render that same catalog as a simple `/models` page, name, context window, and pricing for each one, so anyone can browse the full list without opening the picker.

**Amended by feature 10, before this was built.** The catalog is no longer
free-tier-only. It pulls the whole OpenRouter list, marks which entries are free,
and shows paid models as selectable-but-gated until the person has added their
own key. The `/models` page shows everything for the same reason — its pricing
column is finally worth reading once not every row is zero. The key-entry control
lives in this picker rather than on a settings screen, because this is where the
need actually arises and there is no app shell until feature 7.

- [ ] Decide the approach
- [ ] Build it

### 6. Send a prompt, parallel streams, and voting

The heart of the product. One prompt goes to every selected model at once, each streaming and failing independently, so one being slow or down never blocks the others. Each answer shows its own real time-to-first-token, tokens per second, total tokens, and cost. A vote only exists once two or more models have answered, and picking one writes exactly one vote and marks that answer as the winner, while every answer stays visible the whole time. A follow-up continues each model's own separate conversation.

**Two amendments from feature 10**, both made before this was built:

- **Cost is shown.** The original "no cost shown, it would always read zero"
  reasoning stops holding the moment someone can bring their own key, and
  `CLAUDE.md` said to show it regardless. A free model reads `$0.000000`, a BYOK
  model reads its real number. This is the resolution of the contradiction
  flagged under feature 3.
- **The API-key input must be masked from session replay** — `ph-no-capture` on
  the field, in place _before_ replay is switched on, not afterwards. Replay is
  turned on as part of this feature, and a key typed into an unmasked input is
  captured in the recording. This is the single most likely way feature 10 leaks
  a credential, and it is prevented here rather than there.

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
- `python-requests/2.31.0` and `Scrapy/2.11` User-Agents → 403, _while the bucket
  was already empty_, confirming bot detection is evaluated before the rate limit.
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

| Model                                | TTFT   | Tokens/sec | Output tokens | Total             |
| ------------------------------------ | ------ | ---------- | ------------- | ----------------- |
| `inclusionai/ling-3.0-tiny:free`     | 1314ms | 421.2      | 342           | 2126ms            |
| `nvidia/nemotron-3.5-lightning:free` | 678ms  | 134.5      | 804           | 6657ms            |
| `google/gemma-4-26b-a4b-it:free`     | —      | —          | —             | failed, see below |

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
spoofed bot User-Agents were denied, _every_ subsequent request from the same
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

**No longer blocked.** The schema was decided and
`20260813032554_initial_data_model` applied on 2026-08-13, with both questions
settled rather than defaulted — see feature 3's "What was decided" above.

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
- [x] The UI, built ahead of the data (see below)

#### The UI, built ahead of the data

Built out of order, on request, immediately after feature 4 landed and while
every data decision in this feature is still open. **Chrome and screens only —
nothing here reads a database, calls a model, or writes a vote.** Every screen
carries a `PlaceholderNotice` saying so out loud, because a page quietly showing
invented numbers as if they were measured is the exact thing this app exists to
argue against.

**Every stand-in value lives in one file**, `features/shell/placeholder-data.ts`,
grouped so each screen's placeholders can be deleted in one piece as its feature
lands — threads with feature 7, the turn with feature 6, rankings with feature 9,
the catalog with feature 5. The numbers in it are the real measurements recorded
in the 2026-08-12 verification run above, so nothing on screen is invented from
nowhere even while it is still a placeholder.

**A route group, `app/(app)/`, holds everything inside the shell.** Sign-in and
sign-up sit outside it deliberately: a sidebar full of somebody's threads is no
use to a person who has not signed in yet. The root layout lost its header in the
same move — the shell owns the app's chrome now, and the auth screens carry only
a wordmark and the theme toggle.

**Thread URLs are `/t/[threadId]`, with `/` a fresh arena that has no thread
behind it yet.** Settled here rather than left to feature 6, because a shell
whose sidebar, breadcrumb and nav all point at `/` is a shell that lies about
navigation, and that is the one thing a frame has to get right.

Two things decided the shape. **Feature 8 is the binding constraint:** a thread
link gets pasted somewhere by a stranger and has to be short, stable, and
readable with no account, which rules out nesting it under anything that reads
as somebody's workspace. And **feature 3's API already implies the flow** —
`POST /api/turns` creates the thread on the first prompt and returns the ids, so
"an arena with no thread yet" is a real state rather than a loading one, and the
move to `/t/[threadId]` happens when the server says the id exists. The route
shape falls out of the data model instead of being imposed on it.

`/arena/[threadId]` was the alternative, mirroring the sketch's "Arena /
Thread 1" breadcrumb exactly. Rejected: the sketches are structure only by this
file's own rule, a breadcrumb is a label hierarchy rather than a path, and that
URL reads as a page inside someone's account — the opposite of what a shared
link should feel like. `/threads/[threadId]` was rejected for length, and for
spending the `/threads` path on a detail route.

**One piece of feature 8 came along for free and is genuinely built:** an unknown
thread id renders a plain not-found page inside the shell rather than an error.
It is proven — `/t/nope` returns 404 today. `findPlaceholderThread` is what
answers "no such thread" for now; feature 7 swaps it for a real query and the
behaviour stays.

**The shell is composed from shadcn's components, not hand-rolled.** This was
not true when this section was first written — see "Reversed, and it should not
have needed asking" below, which records what the hand-rolled version got wrong
and why the reasoning behind it did not hold.

**The metrics panel on a response card is a native `<details>`.** Keyboard
operable and correctly announced with no JavaScript and no state, which is worth
more than a custom disclosure on a card that will eventually have three of itself
side by side, each streaming.

**The leaderboard's Personal tab is an empty state, not a second table of
invented rows.** Nobody has voted yet, so "You haven't voted yet" is the true
screen, and it is one feature 9 has to build anyway.

Screens built, each ahead of the feature that fills it: the arena (feature 6),
the leaderboard (feature 9), and the models catalog (feature 5). The shell
chrome itself is this feature's own. Files: `features/shell/`,
`features/arena/`, `features/leaderboard/leaderboard-screen.tsx`,
`features/models/model-catalog.tsx`, and `features/models/model-mark.tsx` plus
`features/ui/placeholder-notice.tsx` as the shared pieces.

#### Reversed, and it should not have needed asking

The shell was hand-rolled first — sidebar, breadcrumb, badges, empty states, the
segmented control, all of it as styled `div`s. That was wrong, it was decided
silently rather than reported, and it was reversed when it was queried.

**The reason given for it did not survive contact with the component.** The
argument was that shadcn's Sidebar arrives with its own `--sidebar-*` token
family and would amount to a second palette. It is eight CSS variables, and
pointing them at the tokens that already exist is eight lines in `globals.css`.
It was worth doing for a reason stronger than tidiness, though: the default
`--sidebar-ring` ships as **blue**, which this project's design rules forbid
outright. Installed and left alone, the sidebar would have quietly broken
feature 4.

**What the hand-rolled version was missing** is exactly what had to be
hand-written and then fixed: the mobile/desktop open-state split, easing on
collapse, and a focus-trapped mobile panel. shadcn ships all three, plus cookie
persistence so a reload keeps the collapsed state, `Cmd`/`Ctrl+B`, an icon rail,
and `SidebarMenuSkeleton` for the loading state feature 7 needs.

**It was not only the sidebar.** Running shadcn's own rules over the build found
seven more places where custom markup stood in for a component that existed:
`<hr>` for `Separator`, three empty states for `Empty`, a notice `div` for
`Alert`, two badge-shaped spans for `Badge`, and a pair of buttons for
`ToggleGroup`.

**The audit tax is real and was paid.** Four of the eleven vendored components
now in `features/ui/` shipped an accessibility defect against this palette: the
same 3px, 50%-opacity focus ring in `Button`, `Input`, `Badge` and `Toggle`,
under 3:1 against the coffee ground; and `text-white` on the destructive variant
of both `Button` and `Badge`, which is 3.66:1 on the dark-mode red where the
token is 5.02:1. All fixed in place with the reason written beside each change.
Anyone adding a shadcn component to this project should expect to check the same
two things.

**Three ESLint rules had to be handled rather than ignored.** `use-mobile` calls
`setState` in an effect and `SidebarMenuSkeleton` calls `Math.random()` in a
`useMemo`; both are upstream code predating the React Compiler rules, and both
are switched off for `features/ui/**` only — scoped to those two rules, so `any`,
the import boundaries and `console.log` still apply there. The third was
`SidebarMenuButton` reassigning its `tooltip` parameter, which is a rule with a
real reason behind it, so that one was fixed in the component instead of
exempted.

**Two costs, both accepted deliberately.** Reading the sidebar cookie on the
server makes `AppShell` a server component, which drops `/`, `/leaderboard` and
`/models` from prerendered to server-rendered on demand. Worth it: the
alternative is the panel flicking open and then shut on every reload, and these
routes go dynamic anyway the moment they read a real thread for a signed-in
person. And `radix-ui` is now a real dependency rather than a transitive one.

**Four things found only by looking at the running app**, none of which a type
checker or a linter would ever have caught:

- **The thread list vanished when collapsed**, which took away the main thing a
  sidebar is for. It is now one button that reopens the panel — a thread has no
  icon, so rendering four of them on the rail would have been four identical
  blank squares.
- **`SidebarInset` needed `min-w-0`.** Without it that flex child refuses to
  shrink below its content's intrinsic width, and a wide response grid pushes
  the whole page into a horizontal scrollbar.
- **`SidebarContent` is `overflow-auto`, which is both axes.** A sidebar has no
  business scrolling sideways at any width, and several of its own children —
  the rail's `-right-4`, the group action's `after:-inset-2` — render outside
  their parent's box by design. The x-axis is clamped rather than left to
  whichever one overhangs.
- **`SidebarRail` set a `w-resize` cursor for a drag that does not exist.** The
  rail only toggles on click, so the cursor was promising a resize the component
  has never supported. Now a pointer, which is what actually happens.

#### Corrected while building

- **The models page asserted a rule feature 10 had already repealed.** Its copy
  read "all of them are free tier, which is why every price reads $0.0000",
  which was true of the placeholder list and false of the catalog feature 5 is
  now specified to build. Reworded, and the notice now says the list widens with
  features 5 and 10 rather than implying free tier is permanent.
- **Cost was rendered at four decimal places**, following `CLAUDE.md`'s wording,
  before feature 10's `$0.000000` was noticed. Now six, matching what `costUsd`
  actually stores — which is the precision that starts mattering the moment a
  BYOK response has a real number in it.
- **Two more shadcn components shipped the weak focus ring** already fixed on
  Button during feature 4 — Textarea directly, and every control that inherits
  it. Fixed the same way, for the same measured reason.

#### Verified by hand

Against the running dev server, no test runner:

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` all clean.
  Ten routes in the manifest, the three API routes untouched. All screens are
  server-rendered on demand rather than prerendered, for the sidebar-cookie
  reason recorded above.
- Every `--sidebar-*` token in the served CSS resolves to a `var()` pointing at
  the existing palette. No blue anywhere.
- `/`, `/leaderboard`, `/models`, `/sign-in` and `/t/thr_8f2k9a0001` all return
  200, and each renders its own content — the sidebar's thread list, the empty
  arena's invitation, the thread's placeholder turn, the leaderboard's global
  ranking, and the catalog's formatted context windows.
- `/t/nope` returns **404** and renders the plain not-found page, so the
  unknown-thread rule is proven rather than asserted.
- One transient failure worth recording: `tsc --noEmit` failed once with
  `Cannot find module '../../app/page.js'` immediately after `app/page.tsx` moved
  into the route group. That is Next's generated route validator gone stale, not
  a real type error; the next `pnpm build` regenerated it and the check went
  clean. Worth knowing before someone debugs the wrong thing after moving a page.

**Not verified, and it needs eyes:** the whole thing by sight. Layout at every
breakpoint, the sidebar collapsing and the mobile overlay, focus order through
the shell, and the screens in both themes. This project has no browser
automation by decision, so that is a human pass.

## Slice 3: Public visibility & sharing

### 8. Public thread visibility & sharing

Anyone should be able to open a thread's link and see it, without an account, that's what actually makes it shareable. Only sending a prompt and voting need sign-in. A made-up or deleted thread just shows a plain not-found page either way. The thread's real owner sees everything everyone else sees, plus the ability to actually use it.

- [ ] Decide the approach
- [ ] Build it

## Slice 4: Leaderboard

### 9. Leaderboard: global & personal

Two leaderboards from the same votes, one for everyone, one just for the signed-in user. Each row's win rate is the big, bold number, in the accent color, with a small bar next to it, always written as "won 4 of 5," never a bare percentage or a made-up score. Smaller, quieter numbers underneath for average speed and time-to-first-token, each clearly labeled. No cost or "cheapest" stat, every model is free, so that number never means anything here. First place gets a subtle highlight, nobody else does.

**Amended by feature 10.** The **global** board counts only responses that ran on
this app's own key — `usedOwnKey = false` — so it stays exactly what it claims to
be, an honest free-tier ranking, and its "no cost stat" rule still holds for the
right reason rather than by accident. The **personal** board counts everything
that person ran, free and BYOK together, since comparing a paid model against a
free one is the entire point of bringing a key. That means the personal board
_can_ carry a meaningful cost number; whether it should is this feature's call.

The read-path index question is deliberately left open here rather than guessed
at in feature 10's migration: the global query gains a `usedOwnKey` filter, and
whether that wants a third column on `@@index([modelId, status])` or a partial
index depends on the query this feature actually writes.

- [ ] Decide the approach
- [ ] Build it

## Slice 5: Bring your own key

### 10. Bring your own key

Every model in the arena is free tier, which is the honest constraint the whole
app is built around — and also its ceiling. The models people most want compared
are the ones that cost money. This feature lets a signed-in person paste their own
OpenRouter key and put a paid model in the arena beside the free ones, without
this app ever paying for it or ever storing the key.

Depends on feature 5 (the catalog has to show paid models) and feature 6 (the
streaming and voting path has to exist to extend). Both are amended above rather
than left to be retrofitted.

- [x] Decide the approach
- [ ] Build it

#### What was decided

**BYOK responses feed the personal leaderboard only.** The global board is this
app's public claim — an honest free-tier ranking — and quietly mixing paid models
into it would change what that number means for every visitor who never asked for
it. There is also a selection-bias problem that no amount of votes fixes: a BYOK
user pits an expensive model against whatever free models happen to be selected,
so paid win rates would read better than they are. A `usedOwnKey` flag on
`ModelResponse` is all this costs, and feature 9 filters on it. The alternative
considered and rejected was splitting the global board into free and BYOK tiers —
more informative in principle, but it is real UI and query work for a tier that
stays statistically thin for a long time.

**The key lives in the browser session and is never written down.** Held in
`sessionStorage`, sent with the calls that spend it, and gone when the tab closes,
with an explicit "Forget my key" control so nobody has to close a tab to revoke.
Not `localStorage`, which is durable on disk; not React state alone, which loses
the key on every refresh — annoying enough that people paste their keys into a
notes file, which is strictly worse than either.

The rejected alternative was encrypting keys at rest in a `UserApiKey` table. It
reads more professional and buys two real things — the key crosses the wire once
instead of per call, and `/api/chat`'s hardened body stays untouched — but its
worst case is unbounded and discovered late: a database dump plus the encryption
secret is every user's paid provider key. And the encryption buys less than it
looks like, because `KEY_ENCRYPTION_SECRET` would sit in the same environment as
`DATABASE_URL`, so one env leak takes both halves. Doing that properly means
envelope encryption against a KMS, which is infrastructure this project does not
have and should not grow in order to hold other people's spending credentials.
Session-only has failure modes too, but every one of them is preventable with
something inside this repo — see the mitigations below.

Also rejected: **calling OpenRouter from the browser.** It is the strongest
option on custody alone, since the server would never see the key at all, and it
is fatal on everything else. Arcjet stops applying to those calls entirely, so
the app becomes an uncontrolled front end for arbitrary OpenRouter traffic. And
timings and content would become client-reported, inverting the trust boundary
feature 3 spent four review rounds building — fabricated tokens/sec written
straight into the database of an app whose entire claim is honest measurement.

**The key travels as a header, not in the body.** `X-Arena-Provider-Key` on
`POST /api/chat`, which means the key crosses the wire three times per prompt —
once per parallel call — because `/api/chat` is where a provider is actually
called. It deliberately does not go to `/api/turns`, which spends nothing.

The header rather than the body is a security choice, not a style one.
`/api/chat`'s body is `{ modelResponseId }` and `.strict()`, and that shape is
the conclusion of four rounds of review that ended with deleting inputs rather
than validating them. Threading a credential back into it would reverse exactly
that direction. A header also keeps "never log the request body" true as a flat
rule with no exception, and headers are what logging and observability tools
already redact by convention while bodies get captured wholesale. Not
`Authorization` — that is Clerk's.

**The money gate moves from `/api/turns` to `/api/chat`, and the invariant is one
sentence: this app's own key is only ever used for a `:free` model id.**
`/api/turns` currently rejects a paid id outright, which cannot stand once paid
ids are legitimate. So `freeModelIdSchema` splits — a `modelIdSchema` that checks
shape (`author/slug`, `:free` optional) and a pure `isFreeModelId` predicate.
`/api/turns` validates shape only. `/api/chat` reads `modelId` off the reserved
row, and if it is not free and no key header arrived, it refuses before the
provider is called.

That is the same structural move the codebase already made twice: decide from
what the server can read, not from what the caller claims. A client flag saying
"trust me, I have a key" would be the wrong shape even though it happens to be
safe here, and one check at one call site is something a person can verify by
reading a single function.

**`usedOwnKey` records what actually happened, never what was claimed.** It is
set by the same code that chooses which key to hand the provider, so the column
is derived from the branch that was taken. It is not a request field and there is
no path by which a caller can set it.

**BYOK calls still cost an Arcjet token.** The bucket was sized in model calls to
protect this app's money, and a BYOK call spends someone else's — but the bucket's
real meaning is "how much work this app will do for one person", which is
unchanged. Making BYOK calls free of the bucket would turn the app into an open
proxy limited only by the user's own balance. No code change, which is the best
kind of decision.

**No key-validation endpoint.** A `GET` that pings OpenRouter's `/key` to say
"valid" before the first prompt is genuinely nice, and it is one more route that
handles a secret in exchange for feedback the first prompt delivers in seconds
anyway. The bad-key sentence below covers it.

**One provider, one key.** OpenRouter only. A direct Anthropic or OpenAI key
would mean a second provider integration, a second usage/metrics shape, and a
second error mapping, for models OpenRouter already carries.

#### The three mitigations, as requirements rather than good intentions

Session-only storage is safe because of these, so they are part of the build, not
advice attached to it.

1. **The key input is masked from PostHog session replay before replay is ever
   switched on.** Written into feature 6 above as well, since that is where replay
   lands. A key typed into an unmasked field is captured in the recording, and
   this is the most probable leak in the whole design.
2. **The `/api/chat` request, its headers, and its body are never logged,
   serialized into an error, or attached to a PostHog event property or an Arcjet
   characteristic.** The route already logs only the provider exception and shows
   a plain sentence; that was cosmetic before and is load-bearing now.
3. **The key is read once, in one function, into a local, and passed directly to
   the provider factory.** It is never stored on a module-level value, never put
   on the `ModelResponse` row, and the provider instance built from it is
   per-request — which also means `features/models/openrouter.ts`'s module-level
   singleton stops being the only way a provider gets made.

#### Failure modes, and the sentences for them

Three provider failures become worth telling apart, because the fix differs. Any
other failure keeps the existing generic sentence.

- **Paid model selected, no key present** → refused before the provider is
  called. "That model needs your own API key."
- **Key rejected by OpenRouter (401)** → "OpenRouter didn't accept that key."
  This one matters most: swallowed into the generic "That model didn't answer",
  a single wrong character would look like every paid model being broken.
- **Key out of credit (402)** → "That key is out of credit."

None of these echo a provider payload, and none of them can contain the key.

#### The Postman collection changes with it

No new routes, but two existing ones change shape, and one existing request
becomes a lie the moment this ships:

- **"Paid model → 400" on `/api/turns` must be rewritten**, because a paid id is
  now a legitimate 201. It becomes the `/api/chat` refusal instead.
- **`/api/chat` with a paid model and no key header → 400.**
- **A BYOK happy path**, marked manual like the two 403 requests already are,
  since it needs a real key and real credit that cannot live in the collection.
- The environment template gains a `providerKey` variable, left empty, and the
  collection itself still holds no secrets.

#### The build checklist

- [ ] Split `freeModelIdSchema` into `modelIdSchema` + `isFreeModelId`; loosen
      `/api/turns` to shape-only validation
- [ ] Migration: `usedOwnKey Boolean @default(false)` on `ModelResponse`
- [ ] Per-request provider construction in `features/models/openrouter.ts`
- [ ] The money gate and the three error sentences in `/api/chat`
- [ ] `usedOwnKey` written from the branch actually taken
- [ ] Key entry, masking, and "Forget my key" in feature 5's picker
- [ ] Cost shown on the response card (feature 6's corrected rule)
- [ ] Postman collection updated, including the rewritten "Paid model" request
- [ ] `pnpm check` and `pnpm build`, then verified by hand with a real key

#### Verified by hand

_Nothing yet — this feature is decided, not built._

## Not doing right now

Kept here so the plan stays honest about what's deliberately left out.

- A "fastest" label on the leaderboard, tagging whichever model already has the best average speed, only for models with enough votes to mean anything. Nice to have, not required.
- Privacy policy and terms pages.
- Rich link previews when a thread gets shared somewhere.
- Any kind of admin or moderation page.
- A public API for the leaderboard data. Nobody's asked for this.
