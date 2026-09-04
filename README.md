# Nexora

**Know what changed. Know why it matters.**

## What Nexora Is

Nexora is an explainable market-intelligence layer for a stock watchlist. It helps a user focus on the instruments that deserve attention instead of scanning every price movement.

## Problem It Solves

A watchlist shows many changes, but not all changes matter equally. Nexora compares market observations with the user's previous visit, ranks meaningful movement, and explains the signals behind each result.

## Core Flow

**TRACK -> DETECT -> SCORE -> EXPLAIN**

- **Track:** Maintain authenticated watchlists of supported Indian instruments.
- **Detect:** Compare new market observations with the user's last-seen boundary.
- **Score:** Calculate deterministic market significance and personal relevance.
- **Explain:** Show the signals and facts that produced the Attention Score.

## Meaningful Change

A change is surfaced when its computed Attention Score reaches the user's sensitivity threshold. The score considers:

- **Price anomaly:** movement compared with the instrument's typical move.
- **Volume anomaly:** volume compared with its recent average.
- **Relative performance:** gap versus the NIFTY benchmark.
- **Volatility change:** change in typical movement versus the previous observation.
- **Event importance:** relevant earnings, dividend, split, bonus, or announcement events.
- **Personal relevance:** watchlist priority; high-priority items receive a relevance boost.

The scoring weights are 35% price, 25% volume, 20% relative performance, 10% volatility, and 10% event importance. Sensitivity changes the surfacing threshold, not the underlying market facts.

## Temporal Behavior

The dashboard uses `profiles.last_seen_at` as its temporal boundary. It considers observations after that timestamp and compares them with the appropriate prior baseline. On a first visit, the seeded current state is available for evaluation. A dashboard visit is marked seen only after the initial dashboard has rendered successfully.

## Stale and Missing Data

Every observation includes its timestamp, source, and freshness state. Data is classified as fresh, delayed, or stale. Stale data remains visible with an explicit warning. Symbols without an available observation are reported as missing rather than silently omitted.

## Architecture

Nexora is a modular monolith:

- `src/components/nexora/`: React UI for the dashboard, watchlists, stock details, authentication, and settings.
- `src/lib/nexora.functions.ts`: authenticated TanStack Start server functions and Supabase data access.
- `src/lib/attention/engine.ts`: pure, deterministic Attention Engine and explanation data.
- `src/lib/nexora/build-dashboard.ts`: pure dashboard model builder, including last-seen filtering.
- `src/lib/market/`: normalized market types, supported instruments, and the deterministic demo provider.
- `supabase/migrations/`: PostgreSQL tables, RLS policies, bootstrap trigger, and seeded demo data.

## Tech Stack

- TypeScript
- React 19
- Vite and TanStack Start/Router
- Tailwind CSS and existing Radix UI primitives
- Supabase PostgreSQL, Authentication, and Row Level Security
- Vitest for pure logic tests

## Run Locally

Copy `.env.example` to `.env` and provide the Supabase project values. Keep `.env` and the service-role key out of Git.

```sh
npm install
npm run dev
```

The application requires an authenticated Supabase session. The database migration must be applied to the configured Supabase project before using the authenticated features.

## Run Tests

```sh
npm test
```

Tests run in a Node environment and cover the Attention Engine and temporal dashboard behavior without network or database calls.

## Judge Demo Flow

1. Open the app and sign in or create an account.
2. Review the seeded dashboard and its ranked, explainable changes.
3. Open **Watchlists** to create or rename a list, add supported instruments, and change priority.
4. Click a stock to inspect its **Stock Details**, signals, event context, freshness, and recent history.
5. Return to the dashboard and click **Simulate Market Update**. The deterministic demo provider writes new observations and events, then the dashboard reloads them using the last-seen boundary.
6. Open **Settings** to change sensitivity, default watchlist, or display name.

Nexora does **not** provide buy/sell advice, forecasts, brokerage services, or trading recommendations.
