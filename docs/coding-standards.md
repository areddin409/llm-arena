# Coding standards

The conventions this project actually follows, and the tool that enforces each
one. `CLAUDE.md` states the rules; this file says how they are held in place and
why each choice was made. If a rule here is not enforced by anything, that is
noted as a convention rather than dressed up as a guarantee.

## The one command

```bash
pnpm check    # format:check → lint → typecheck
```

That is the gate. `pnpm build` is the fourth thing to run before calling any
piece of work done, and it is deliberately not folded into `check` — a full
Next build is slow enough that it would stop people running the other three.

Individually:

| Command             | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `pnpm format`       | Prettier, writes                               |
| `pnpm format:check` | Prettier, reports only — what CI and hooks use |
| `pnpm lint`         | ESLint across the project                      |
| `pnpm typecheck`    | `tsc --noEmit`                                 |
| `pnpm build`        | The real Next production build                 |

## What runs automatically

**On commit** — `lint-staged` runs `eslint --fix` then `prettier --write` on the
staged files only, so it finishes in well under a second. ESLint runs first so
that anything it autofixes still gets formatted afterwards. A lint error the
autofixer cannot resolve fails the commit and the working tree is restored
untouched.

**On push** — the full `pnpm check`. A type error cannot be caught by looking at
staged files in isolation, because changing one file can break the type of
another that was not staged. That check is whole-project by nature, so it runs
once per push rather than on every commit. This is the deliberate split: commits
stay fast, and nothing broken reaches the remote.

Hooks live in `.husky/`. `--no-verify` exists; using it means the pre-push check
runs on someone else's machine instead, so it should be rare and deliberate.

## Formatting

**Prettier owns formatting. ESLint owns correctness.** No overlap, no stylistic
ESLint rules, no arguments about them.

Prettier's defaults are taken as-is — there is no house style to learn, and
every option not set is an option nobody has to have an opinion about. The one
plugin is `prettier-plugin-tailwindcss`, which sorts Tailwind classes into a
canonical order. That is not cosmetic here: it makes a repeated cluster of
classes look identical everywhere it appears, which is what makes the "if the
same handful of classes shows up in three places, that's a component" rule
something you can actually see rather than something you have to remember.

**Biome was considered and rejected.** It would replace both tools and run
faster, but `eslint-config-next` carries Next 16's own rules and Biome has no
equivalent. Trading those away to save a second of lint time is a bad deal on a
project this size.

**Line endings are LF, forced by `.gitattributes`.** Git's Windows default
(`core.autocrlf=true`) checks files out as CRLF while Prettier writes LF, so
without that file `pnpm format:check` fails on every file in the repo on a fresh
clone — which reads as a broken tool and is really a line-ending mismatch.

What Prettier does not touch is listed in `.prettierignore`, and each entry
there carries its reason. The load-bearing ones: vendored agent skills under
`.claude/skills/` and `.agents/skills/` are hashed in `skills-lock.json` and
would read as locally modified if reformatted; Excalidraw owns the encoding of
its own markdown in `docs/ui-sketch/`; and the Postman collection is edited in
Postman, which formats its own export.

## TypeScript

`strict: true`, plus `noUncheckedIndexedAccess`. The second one makes indexing an
array or record produce `T | undefined`, which is the truth. This app is built
out of streamed chunk arrays and provider usage objects where a missing element
is a normal occurrence, and the alternative is a `TypeError` in production at the
exact moment a model returns something slightly unusual.

**No `any`, and that is an error rather than a warning.** The Next preset ships
`no-explicit-any` as a warning, which in practice means nobody ever fixes one.
When a third-party shape genuinely is not typed, the answer is `unknown` plus a
narrowing check, or a Zod schema at the boundary — the same thing `env.ts` and
`features/chat/chat-request.ts` already do.

**Type-only imports are marked** (`consistent-type-imports`, inline style), so it
is visible at a glance which imports pull in real runtime code and which vanish
at build time.

## Functional style

Pure functions by default, no shared mutable state, side effects at the edges.
`features/chat/call-metrics.ts` is the pattern worth copying: the arithmetic is a
pure function, and the single mutable cell holding the stopwatch is scoped to one
request and never shared.

Enforced: `prefer-const`, `no-var`, and `no-param-reassign` including properties
— reassigning a parameter quietly invalidates what the caller believes it handed
over.

Not enforced, and deliberately so: there is no `eslint-plugin-functional`. It
fights React hooks and the Prisma client hard enough that it would be disabled
inside a week, and a rule everyone disables is worse than a written convention
everyone reads. Preferring `map`/`filter`/`reduce` over a mutating loop, and
`readonly` on anything that should not change, are conventions held by review.

## Folder by feature

Code lives under `features/<name>/`, not in layer-wide folders. Each feature owns
its internals and is reached through its top-level files.

Three ESLint rules keep this real rather than aspirational:

- Any relative import that climbs out toward `features/` is an error, at every
  depth. Use `@/features/<name>/...`.
- A sibling feature reached relatively — `../models/x` from inside
  `features/chat` — is an error for the same reason, even though it does not
  look like climbing out.
- One feature importing into another feature's _subfolder_ is an error. Cross a
  feature boundary at its top level or not at all.

Those patterns are spelled out per depth rather than written as one glob with a
leading `**`, which would also match the `@/features/...` form the rules exist to
push people toward. Four levels covers the repo with room to spare. If a feature
ever nests deeper than that, extend the depth list — and note that the per-feature
config blocks repeat the project-wide patterns deliberately: a later ESLint config
object _replaces_ `no-restricted-imports` rather than merging with it, so listing
only the feature-specific patterns there would switch the shared ones off for
exactly the files that need them most.

`app/` holds routes and layout only. A route handler wires features together; it
does not hold logic that another route could ever want.

The Prisma client is constructed in exactly one place, `features/database/prisma.ts`,
and importing `@/prisma/generated/**` directly is an error everywhere except that
one file, which needs it to construct the client and is exempted by name. There was a second
client in a `lib/` folder once; it read `process.env` unvalidated, was not marked
`server-only`, and leaked connection pools in development. It is gone, and the
lint rule is what stops it coming back.

## Errors and logging

**A raw exception or provider error never reaches the user.** The server logs the
real thing; the user gets a plain sentence and a way to retry. `app/api/chat/route.ts`
is the reference implementation.

`console.log` is a lint error. Not because logging is bad, but because the choice
between `console.error` and `console.warn` should be made on purpose — this is a
server that logs provider failures, and "info that turned out to be an error" is
how detail goes missing. Root-level config files are exempt; they legitimately
report at startup.

## Environment variables

Every variable is declared in `env.ts` with a Zod schema, parsed once at import
time, and `instrumentation.ts` imports it so a bad value kills the server on boot
and lists every problem at once. Never read `process.env` in application code.

Validate the shape, not just presence, whenever a wrong-but-non-empty value is
realistic. `DATABASE_URL` checks for a `postgres://` scheme because the actual
mistake people make is pasting a dashboard URL, and `ARCJET_KEY` checks for the
`ajkey_` prefix. Both fail far later and far more confusingly otherwise.

## Styling

Shared values — spacing, color, repeated patterns — live in `app/globals.css` or
in a shared component. Never copy-pasted as raw Tailwind class strings across
files. The design direction itself (the warm dark background, the single rust
accent, green only for a winner, red only for errors) is decided in
`docs/scope.md` under feature 4 and is not restated here; that file is the source
of truth for it.

Accessibility baseline on every screen, no exceptions: real contrast, a visible
focus state, and full keyboard operation. `eslint-plugin-jsx-a11y` runs as part
of `eslint-config-next`, but it only catches static markup problems — contrast
and keyboard flow have to be checked by hand in a real browser.

## Testing

**There is no test runner and no browser automation in this project, by
decision.** Verification is a running dev server plus a real browser, or `curl`,
or the Postman collection at `docs/llm-arena.postman_collection.json`. Do not
install one to check that something works.

Every new route goes into the Postman collection in the same step that creates
it — happy path and each way it fails, each with a description of what to expect
back. A collection that lies about the API is worse than no collection, and the
only way it stays honest is if updating it is never a separate task.

Scripts inside the collection capture variables. They never assert; assertions
would be a test runner by another name.
