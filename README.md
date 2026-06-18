# Fagdag Juni — Debug Race

A timed, AI-assisted debugging challenge. You get a working dashboard
backed by six pure functions in `src/solution.ts`. Each function has a bug.
The dashboard renders every one of them, so every bug shows up somewhere in
the UI. Use your AI tool of choice to find and fix them, then hit
**Submit & grade**.

The grader runs your functions against a dataset that's unique to you —
**hardcoding answers won't work**. Fix the logic.

## Setup

```bash
npm install
npm run dev
```

Open <http://localhost:5173>, type your name (no password — the server
issues you a UUID and the browser keeps it in `localStorage`), and the
clock starts the moment you click **Start the challenge**.

The API URL is already wired in (`.env`). You only need `.env.local` if
you're pointing at a different host.

## The rules

- You only edit `src/solution.ts`. `src/App.tsx` is the renderer — leave it
  alone.
- Don't change function names, signatures, or the exported types.
- Keep every function pure (no mutation of inputs, no side effects).
- You can submit as many times as you want — your **best score, fastest time**
  is what shows on the leaderboard.

## The six functions

| # | Function | What it computes |
|---|---|---|
| 1 | `weightedCompletionRate` | % done as a whole number — but weighted by points, not ticket count |
| 2 | `prioritySort` | new array sorted by priority desc → points desc → id asc |
| 3 | `estimateSprintDays` | whole days to finish open work at the given velocity |
| 4 | `assigneeStats` | per-person `{ open, done, points }` (points = open only!) |
| 5 | `unblockedReady` | ids of open tickets whose every blocker is done |
| 6 | `topNByAssignee` | per-person top N open tickets, sorted points desc → id asc |

The full spec for each — including all the edge cases — lives in the JSDoc
above each function in `src/solution.ts`. **Read it carefully before you
prompt your AI.** The function name suggests the rough shape; the JSDoc
nails the corner cases. The bugs hide in between.

## How to prompt well

A few things that consistently help:

1. **Paste the JSDoc**, not just "fix this function." The constraints in the
   doc are exactly what your AI needs to write the right impl.
2. **Compare against the dashboard.** Every wrong number on screen is a hint
   about which bug you haven't squashed yet — and which constraint your AI
   missed.
3. **Submit early and often.** The `/submit` response tells you exactly which
   tasks pass and which fail. Use it to verify before moving on.

Good luck.
