# LLM Arena

Send one prompt, watch up to three AI models answer it at the same time, and vote for the best one. Over time those votes and the real per-call numbers, speed, tokens, cost, build an honest leaderboard of which model is actually worth using.

Every model in the arena is free tier, so cost always reads $0.0000, that's correct, not a bug.

## Status

Early build, foundation phase. The core arena loop (model picker, parallel streaming, voting) and the leaderboard are not built yet. See [`docs/scope.md`](docs/scope.md) for the full plan, what's done, and what's next.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind
- shadcn/ui for components
- Prisma + PostgreSQL
- Clerk for auth
- Arcjet for rate limiting, bot protection, and prompt-injection shielding
- PostHog for analytics, session replay, and LLM call observability
- OpenRouter for model access

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
pnpm build   # production build
pnpm lint    # eslint
```
