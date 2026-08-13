# PostHog Self-driving Setup Report

_Generated 2026-08-12 · Project 481532 · LLM Arena_

## Summary

PostHog Self-driving is now configured for LLM Arena. Session Replay, Error Tracking, Support (Conversations), health checks, and web analytics signal sources are enabled; the scout troop is tuned with five active scouts matched to this product's current instrumented surfaces. Findings will start appearing in the [Self-driving inbox](https://us.posthog.com/project/481532/inbox) within approximately 30 minutes as the first scout runs complete.

---

## AI data processing

**Approved.** Organization-level AI data processing consent was confirmed before the run started.

---

## GitHub

**Connected during this run.** GitHub App installed on account `areddin409` (integration ID 215303, connected 2026-08-12). Self-driving can now research findings against the repository and open draft PRs.

---

## Products enabled

The `products-enable` tool was not available on this PostHog deploy. The following products must be turned on manually by a project admin:

| Product                 | Status        | Action needed                                              |
| ----------------------- | ------------- | ---------------------------------------------------------- |
| Session Replay          | Not confirmed | Settings → Session replay → "Record user sessions"         |
| Error Tracking          | Not confirmed | Settings → Error tracking → "Enable exception autocapture" |
| Support (Conversations) | Not confirmed | Click "Support" in the PostHog product sidebar             |

**Web app init check:** The `posthog.init(...)` call has not been added to this repo yet — the PostHog packages are installed (`posthog-js`, `posthog-node`, `@posthog/next`) and env vars are validated at boot, but the client-side initialization is planned for feature 6. No overrides to check today. When client init lands, confirm it does not set `disable_session_recording: true` or `capture_exceptions: false`.

**Support / Conversations note:** Once the product is enabled, tickets only arrive in the inbox once an inbound channel (email, inbox, or Slack) is connected in PostHog. Connect a channel as a follow-up.

---

## Signal sources

| Source product   | Source type                | Action                                                            | ID                                     |
| ---------------- | -------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| `health_checks`  | `health_issue`             | Enabled                                                           | `019ff7fc-6b5f-7069-bf5e-8427b041d95d` |
| `error_tracking` | `issue_created`            | Enabled                                                           | `019ff7fc-7831-76cd-9ca1-9eb91af6aa90` |
| `error_tracking` | `issue_reopened`           | Enabled                                                           | `019ff7fc-7a7d-746b-bd73-e2040c09b64c` |
| `error_tracking` | `issue_spiking`            | Enabled                                                           | `019ff7fc-7d48-7792-892f-946670e0d5a5` |
| `session_replay` | `session_analysis_cluster` | Enabled (sample rate 10%)                                         | `019ff7fc-8d33-7695-823f-45248b0581fa` |
| `conversations`  | `ticket`                   | Enabled (dormant until channel connected)                         | `019ff7fc-8fd9-7c13-9a64-71524e44d745` |
| `signals_scout`  | `cross_source_issue`       | On by default — no row needed                                     | —                                      |
| `replay_vision`  | —                          | Self-authorizing via scanner `emits_signals` flag — no row needed | —                                      |
| `llm_analytics`  | —                          | Skipped — internal only, not a user-facing responder              | —                                      |
| `logs`           | —                          | Skipped — not a v1 responder                                      | —                                      |

---

## Connected tools

No external connected tools were selected. All issue trackers, support desks, and other external tools were declined as "None of these."

---

## Scout troop

**Run budget:** 100 runs/day (early access default), 0 used today. Banner: _"Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more."_

### Enabled (5 scouts)

| Scout                            | Why enabled                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `signals-scout-general`          | Always on — watches cross-product correlations and surfaces no specialist covers         |
| `signals-scout-ai-observability` | Core product is LLM model comparison; LLM analytics (`$ai_*` events) land in feature 6   |
| `signals-scout-health-checks`    | New project with fresh PostHog instrumentation; catches setup issues early               |
| `signals-scout-web-analytics`    | Next.js web app with posthog-js installed; watches session volume and traffic health     |
| `signals-scout-web-vitals`       | Streaming comparison UI; per-page Core Web Vitals matter for a latency-sensitive product |

### Disabled (22 scouts)

| Scout                              | Reason                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `signals-scout-error-tracking`     | Covered by the native error tracking source (step 4) — re-enable would duplicate it          |
| `signals-scout-session-replay`     | Covered by the native session replay source (step 4) — re-enable would duplicate it          |
| `signals-scout-feature-flags`      | No feature flags in use yet — re-enable when flags are added                                 |
| `signals-scout-experiments`        | No A/B experiments running yet — re-enable when experiments start                            |
| `signals-scout-product-analytics`  | No funnel/retention insights saved yet — re-enable when analytics are built out              |
| `signals-scout-surveys`            | Surveys not in use — re-enable if surveys are added                                          |
| `signals-scout-revenue-analytics`  | No payment SDK or revenue events — re-enable if billing is added                             |
| `signals-scout-logs`               | PostHog logs product not in use — re-enable if logs are adopted                              |
| `signals-scout-csp-violations`     | No CSP reporting configured — re-enable if CSP is set up                                     |
| `signals-scout-customer-analytics` | No group/accounts analytics — re-enable for B2B expansion                                    |
| `signals-scout-data-pipelines`     | No CDP destinations or batch exports — re-enable if pipelines are added                      |
| `signals-scout-data-warehouse`     | No external data sources connected — re-enable when warehouse sources are added              |
| `signals-scout-replay-vision`      | No prior scanners existed before this run — re-enable after scanners accumulate observations |
| `signals-scout-anomaly-detection`  | No dashboards or insights to watch yet — re-enable when analytics are built                  |
| `signals-scout-observability-gaps` | Disabled to stay within the 10-scout ceiling; re-enable as the troop shrinks                 |
| `signals-scout-apm`                | No distributed tracing / OpenTelemetry spans in this project                                 |
| `signals-scout-conversations`      | Support product has no inbound channel connected yet                                         |
| `signals-scout-inbox-validation`   | Intentionally off on a fresh setup — no resolved reports to validate yet                     |
| `signals-scout-insight-alerts`     | No insight alerts configured                                                                 |
| `signals-scout-mcp-tool-calls`     | No MCP tool call telemetry in this project                                                   |
| `signals-scout-skills-store`       | Not relevant to this project                                                                 |
| `signals-scout-tasks`              | Not relevant yet                                                                             |

---

## Custom scouts

No custom scouts were created. Gap analysis ruled out all candidate surfaces:

| Surface                                        | Considered | Filter that killed it                                                    |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| Prompt → vote completion funnel                | Yes        | Not watchable — events are planned for feature 6; none captured yet      |
| Model vote distribution / preference shifts    | Yes        | Not watchable — voting feature not started                               |
| Authentication funnel (sign-up → first prompt) | Yes        | Not watchable — PostHog client-side init not wired yet                   |
| POST /api/chat error rate                      | Yes        | Not watchable — exception autocapture not wired yet                      |
| OpenRouter model availability                  | Yes        | Not watchable; also covered by ai-observability once `$ai_*` events land |
| Streaming latency regression                   | Yes        | Not watchable; covered by ai-observability once `$ai_*` events land      |

**Future candidates (once feature 6 ships):**

- A **prompt → vote completion rate** scout watching for vote rate dropping while prompt volume holds
- A **model preference shift** scout watching vote distribution across models moving unexpectedly

If any custom scout turns out noisy after creation: set `emit: false` on its config in PostHog to switch it to dry-run (it still runs and logs but writes nothing to the inbox).

---

## Replay Vision scanners

Replay Vision scanners are LLMs that watch individual session recordings on a schedule and push what they find directly into the Self-driving inbox. They are the only part of this setup that spends Replay Vision quota. Findings arrive at half weight and need corroboration before being promoted into a full report.

The `creating-replay-vision-scanners` sizing skill was unavailable on this deploy — monthly credit spend was not verified. Both scanners currently show 0 estimated monthly credits because the project has 0 recordings; they are armed and start working the day recordings begin.

| Scanner            | Type    | What it watches                                                                                             | Query scope                                                                          | Sampling | Est. credits/month    | Status  |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- | --------------------- | ------- |
| Broken experiences | monitor | Visible product breaks: blank screens, spinners that never resolve, actions that do nothing, broken layouts | Sessions entering at `/` (the arena) — scoped to the arena flow, excludes auth pages | 50%      | 0 (no recordings yet) | Created |
| User frustration   | monitor | Users getting stuck: rage-clicking, hammering unresponsive buttons, repeatedly retrying actions             | Sessions with `$rageclick` events — any page                                         | 100%     | 0 (no recordings yet) | Created |

**Why `/` for Broken experiences:** The entire LLM Arena experience lives on the root page — prompt submission, streaming model responses, and voting are all single-page interactions with no separate completion URL. Scoping to sessions entering at `/` targets this flow while excluding the sign-in and sign-up pages. The query can be refined to a specific sub-route once the app gains dedicated arena pages in later features.

**Disjoint queries confirmed:** Scanner 1 filters on where the user entered (`$entry_pathname = "/"`); Scanner 2 filters on what they did (`$rageclick`). A rage-clicking user on the arena creates a small, acceptable overlap — both scanners observe it, but `$rageclick` sessions are a narrow slice. Scanner 2 was deliberately left URL-unscoped so it covers friction anywhere in the app without duplicating Scanner 1's targeting logic.

---

## Follow-ups

- [ ] **Enable Session Replay:** Settings → Session replay → "Record user sessions"
- [ ] **Enable Error Tracking:** Settings → Error tracking → "Enable exception autocapture"
- [ ] **Enable Support/Conversations:** Click "Support" in the PostHog product sidebar
- [ ] **Connect a Support inbound channel** (email / inbox / Slack) so the `conversations / ticket` source produces tickets in the inbox
- [ ] **Wire PostHog client-side init** when feature 6 lands — add `PostHogProvider` to `app/layout.tsx`, confirm no `disable_session_recording: true` or `capture_exceptions: false` in init options
- [ ] **Add custom scouts** after feature 6 ships — strong candidates: prompt→vote completion rate scout and model preference shift scout
- [ ] **Enable `signals-scout-replay-vision`** after the Broken experiences and User frustration scanners have accumulated some observations

---

## What happens next

The scout coordinator picks up the fresh configs within approximately 30 minutes and the first scout runs begin — each drawing from the project's 100-run daily budget. Findings cluster into reports; immediately-actionable ones can kick off coding tasks automatically. Check the inbox at: https://us.posthog.com/project/481532/inbox
