# Review, design&look, 2026-08-18

**Reviewed by**: Claude Sonnet 5 (author on Claude Opus 5)
**Scope**: 25 substantive files (app shell, arena/leaderboard/models screens, design system, vendored shadcn `features/ui/`), branch vs `main`
**Verdict**: Changes requested

## Summary

This branch builds the design system (feature 4) and the app shell UI ahead of its data (feature 7), exactly as `docs/scope.md` describes: a route group with a real sidebar/top-bar shell, a measured warm-coffee palette with rust as the only accent, a vendored-and-fixed shadcn component set, and three screens (arena, leaderboard, models) rendered entirely off one placeholder-data file with honest `PlaceholderNotice` banners. The palette, contrast pairs, and accent discipline are exactly what's documented — no blue/indigo/purple anywhere in the diff, green only marks a winner, red only marks an error. The four vendored-component accessibility fixes (weak focus ring, `text-white` destructive text) called out in scope.md are genuinely present in `button.tsx`, `badge.tsx`, `input.tsx`, `textarea.tsx`, `toggle.tsx`, and the `sidebar.tsx` edits (rail cursor, `tooltip` param, `min-w-0`/`overflow-x-hidden`) all check out against the file. scope.md's account of what was built matches what's in the diff — no lying-record issues found.

The two real problems are a DRY violation the project's own `CLAUDE.md` names almost verbatim (a card-shell class cluster and a label/value row component each duplicated across files instead of factored), and a genuine focus-visibility bug: the composer's "remove model" chip nests an interactive button inside a `Badge` that clips overflow, so its focus ring — the exact thing this branch's own audit narrative spent real effort getting right elsewhere — will be invisible to a keyboard user. Neither is a blocker; both are concrete and cheap to fix.

## Major

### 🟠 Remove-model button's focus ring is clipped by the parent Badge, `features/arena/prompt-dock.tsx:31-46`

**Problem**: The composer's model chip wraps an interactive icon `Button` (the "Remove {model}" control) inside a `Badge`:

```tsx
<Badge variant="outline" className="gap-1.5 py-0.5 pr-1 pl-0.5">
  <ModelMark modelId={response.modelId} size="sm" />
  <span className="max-w-32 truncate">{response.modelName}</span>
  <Button variant="ghost" size="icon-xs" className="rounded-full">
    <XIcon />
    ...
  </Button>
</Badge>
```

`Badge`'s class list (`features/ui/badge.tsx:10`) includes `overflow-hidden`, and the badge's own padding here is squeezed to `pr-1 pl-0.5` (4px/2px) to make room for the nested icon button. `Button`'s focus-visible ring is `ring-2` with a `2px` offset (`features/ui/button.tsx:14`), which needs to render outside the button's own box — exactly where the badge's tight padding and `overflow-hidden` clip it.

**Why it matters**: This is the one interactive control in the whole diff that nests a button inside another vendored component, and it lands on precisely the accessibility property this branch otherwise polices closely — `CLAUDE.md`'s "visible focus" baseline, and the same 2px-rust-ring standard that four other vendored components were hand-edited to meet. A keyboard user tabbing to "Remove {model} from this turn" will see little or no focus indicator.

**Suggested fix**: Don't nest the remove button inside the `Badge`'s clipped box — either drop `overflow-hidden` for this specific composition (e.g. a variant or an inline override), or restructure the chip so the button sits outside the badge's overflow boundary while still looking like one pill (a wrapping `span` styled as the pill, with `Badge` reserved for non-interactive content).

### 🟠 Repeated class clusters and a duplicated component, contradicting `CLAUDE.md`'s explicit rule

**Problem**: `CLAUDE.md` states: _"Shared values, spacing, color, repeated UI patterns, live in `globals.css` or a shared component, never copy-pasted as raw Tailwind classes across files. If the same handful of classes show up in three places, that's a component, not a coincidence."_ Two instances in this diff meet that bar:

- The card shell `rounded-xl border border-border bg-card` is copy-pasted verbatim in three files: `features/arena/response-column.tsx:42`, `features/arena/prompt-dock.tsx:16`, `features/models/model-catalog.tsx:46`.
- A label/value metric row is hand-duplicated as two near-identical local components: `Metric` in `features/arena/response-column.tsx:14-27` and `Detail` in `features/models/model-catalog.tsx:5-18`. Same shape (`dt`/`dd`, `text-xs text-muted-foreground` label, `type-metric` value), different names, one file each — exactly the "second, quieter definition" pattern this project's own `docs/scope.md` calls out elsewhere as a real problem (see `model-id.ts`'s comment on `modelAuthor`).

**Why it matters**: This is the literal, self-described trigger condition the project's own conventions name as needing a component. Left alone, the leaderboard's forthcoming rows and the model picker (feature 5) are the natural next places either pattern gets copied a fourth time, and a future contrast or spacing fix (this project cares about exactly that) will need to be applied in multiple places and will likely drift.

**Suggested fix**: Extract a shared `Card`-shell wrapper or reuse the existing vendored `Card` component from `features/ui/card.tsx` (currently unused by any of the three call sites) instead of hand-rolling the same three classes. Extract one `MetricRow`/`DetailRow` component into `features/ui/` (or a shared spot in the relevant feature) that both `response-column.tsx` and `model-catalog.tsx` import, with a `truncate` prop for the one real difference between them.

## Minor

### 🟡 "Pick this" / "Try again" buttons have no unique accessible name, `features/arena/response-column.tsx:57,76`

**Problem**: Each response card renders a `<Button>Pick this</Button>` (or, on failure, `<Button>Try again</Button>`), with no `aria-label` tying it to the model it belongs to. Up to three of these render simultaneously on one screen, all announced identically by a screen reader or voice-control tool.

**Why it matters**: A non-visual user navigating by button list (a very common screen-reader workflow) hears "Pick this, Pick this, Pick this" with no way to tell them apart short of reading the whole card. This is exactly the kind of gap the project's stated a11y baseline exists to catch, and it's cheap to close before feature 6 wires real voting behavior onto these same buttons.

**Suggested fix**: Add an `sr-only` span or `aria-label` naming the model, e.g. `<span className="sr-only"> {response.modelName}'s answer</span>`, matching the pattern already used elsewhere in this same file (the win-chip's `sr-only` sentence in `top-bar.tsx`).

### 🟡 Arena screen has no real `<h1>`, `features/arena/arena-screen.tsx`

**Problem**: Both arena states (`turn === null` and a real turn) render only `EmptyTitle`/response-card `<h3>` elements. `EmptyTitle` (`features/ui/empty.tsx:61-69`) renders a `<div>`, not a heading, so `/` and `/t/[threadId]` are the only two screens in this shell with no level-1 heading at all — `LeaderboardScreen` and `ModelCatalog` both have an explicit `<h1 className="type-display text-3xl">`.

**Why it matters**: Screen-reader users routinely jump by heading list; the arena page — the product's primary screen — has nothing there, and the response grid's `<h3>` per model skips straight past `h1`/`h2` when a turn is showing.

**Suggested fix**: Give the arena screen a visually-hidden or on-screen `<h1>` (e.g. "Arena" or the thread title), consistent with the other two screens.

## Nits

- ⚪ `features/arena/prompt-dock.tsx:52`, `data-icon="inline-start"` on the `PlusIcon` is dead weight — this project's `buttonVariants` (`features/ui/button.tsx`) never selects on `[data-icon]`, so the attribute does nothing here (it's a convention from the vendored shadcn skill docs, not something this project's Button implements).

## Strengths

- The palette is genuinely measured, not eyeballed: every hex pair in `app/globals.css` matches the ratios `docs/scope.md` claims, and a repo-wide search for blue/indigo/purple turns up nothing but comments explaining why they were avoided.
- The vendored-shadcn accessibility fixes described in scope.md are real and verifiable in the diff: the 2px solid-rust focus ring and `text-destructive-foreground` swap are present and consistently applied across `button.tsx`, `badge.tsx`, `input.tsx`, `textarea.tsx`, and `toggle.tsx`, each with a comment explaining the measured reason.
- `features/shell/placeholder-data.ts` is a well-executed pattern: every screen built ahead of its data carries a `PlaceholderNotice`, and the placeholder numbers are the real measurements from earlier verification runs rather than invented ones.

## Test coverage

No test runner by project decision (`docs/scope.md`, `CLAUDE.md`); the stated gate is `pnpm check` + `pnpm build`, both already green per the task brief, plus a documented manual pass in scope.md. That manual pass explicitly flags contrast-by-eye and the keyboard-only pass as not yet done by a human — this review's two Major findings (the clipped focus ring, and the DRY violation) are exactly the kind of thing that manual pass would need to catch, and the focus-ring one specifically would only surface by tabbing to that control in a real browser.
