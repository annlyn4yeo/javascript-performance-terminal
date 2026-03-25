# jsperf

Terminal-style JavaScript performance analyzer for public URLs.

`jsperf` helps teams quickly answer: "What JavaScript is loaded, how much is unused, and what is hurting interactivity?"

## What It Solves

Modern websites often accumulate heavy, blocking, third-party JavaScript. This creates slow interactivity, poor Core Web Vitals, and difficult debugging across multiple vendors.

`jsperf` makes that visible in one terminal-like report by combining static script discovery and runtime browser metrics.

## How It Works

The app runs a 2-phase pipeline and streams progress live to the UI:

1. Phase 1 (static analysis)

- Fetch page HTML
- Extract script tags
- Measure script sizes
- Detect framework (Next.js, React, Vue, Angular, etc.)

2. Phase 2 (runtime analysis)

- Open a shared Playwright Chromium session
- Capture CDP performance and coverage data
- Compute FCP, TTI, TBT, hydration gap, long-task and unused-JS metrics
- Merge static and runtime results into script-level insights

3. Insight layer

- Classify scripts by intent (framework, analytics, ads, payments, support, monitoring, CDN)
- Generate framework-specific insights
- Generate prioritized recommendations

## Output

The terminal report focuses on:

- Overview metrics (FCP, TTI, TBT, hydration gap, total JS weight, unused JS)
- Script table with host, intent, size, unused percentage, and blocking/risk status
- Framework insights and actionable recommendations

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Playwright (Chromium)
- Chrome DevTools Protocol (CDP)
