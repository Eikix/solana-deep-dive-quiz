# Solana Deep Dive Quiz

Long-form, replayable Solana protocol quiz with explanations, topic filters, and review mode.

## What it includes
- 120 questions across core Solana topics
- Learn mode (instant explanations) + Exam mode (review at the end)
- Topic filters + difficulty mix
- Seeded runs for replayability
- Weakness breakdown by section/tag

## Quick start
```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`

## Scripts
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format
```

## Git hooks
Pre-commit runs format + lint + typecheck, pre-push runs tests. Hooks install on `pnpm install`.

## Deploy
The repo ships with a GitHub Pages workflow. On push to `main`, it builds a static export.

If you want Vercel instead:
```bash
pnpm dlx vercel --prod
```
