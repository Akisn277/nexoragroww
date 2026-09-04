# Market Focus

Build a web application called "Nexora".

TAGLINE:

"Know what changed. Know why it matters."

PRODUCT PURPOSE:

Nexora is a smart market watchlist designed to help users quickly understand what has meaningfully changed in their watchlist since their last visit and what deserves their attention.

This is NOT just a stock-price tracker.

The core product question is:

"Out of everything in my watchlist, what actually deserves my attention right now?"

CORE EXPERIENCE:

User opens Nexora

        ↓

System compares current market state with the user's previous state

        ↓

Detect meaningful changes

        ↓

Calculate an explainable Attention Score

        ↓

Rank the changes

        ↓

Explain why each item was flagged

The application should feel like an attention layer on top of a watchlist rather than another generic stock tracker.

IMPORTANT:

This is an engineering challenge. Prioritize:

- correctness

- reliability

- explainability

- maintainability

- thoughtful edge-case handling

- clean UX

Do not add unnecessary complexity.

==================================================

TECHNICAL DIRECTION

==================================================

- Use TypeScript.

- Use a modern React-based frontend.

- Use Tailwind CSS.

- Use reusable components.

- Use Supabase for PostgreSQL database and authentication.

- Keep the backend as a modular monolith.

- Keep business logic separate from UI components.

- Keep the system feasible on free tiers.

- Do not require a paid market-data API for the core experience.

- Do not introduce microservices, Kubernetes, Kafka, Redis, ML infrastructure, or other unnecessary infrastructure.

==================================================

PRODUCT STRUCTURE

==================================================

1. DASHBOARD

---------------

The Dashboard is the primary Nexora experience.

At the top display:

Nexora

"Here's what changed since your last visit"

Show:

- last visit time

- number of meaningful changes

- number of unchanged stocks

- current market/data status

- data freshness

Meaningful changes should be ranked by Attention Score.

Example:

HIGH ATTENTION

RELIANCE

₹1,376

-3.64%

Attention 87/100

"Price movement is unusually large and volume is 2.8× its recent average."

MEDIUM ATTENTION

TCS

₹3,896

+1.96%

Attention 61/100

"Price movement is above its normal range with elevated volume."

EVENT

HDFC BANK

Quarterly results announced

Also show:

"12 other stocks had no meaningful changes."

If there are no meaningful changes, explicitly display:

"Nothing meaningful changed since your last visit."

The dashboard should immediately communicate what the user needs to look at first.

==================================================

2. WATCHLIST

==================================================

Users should be able to:

- create a watchlist

- rename a watchlist

- add stocks

- remove stocks

- search stocks

- mark a stock as Normal or High Priority

- view current market information

Prevent duplicate stocks in the same watchlist.

Use realistic Indian stock data.

Initially support approximately:

RELIANCE

TCS

INFY

HDFCBANK

ICICIBANK

SBIN

ITC

LT

MARUTI

AXISBANK

BHARTIARTL

SUNPHARMA

WIPRO

ADANIENT

TATAMOTORS

The UI should make adding/removing stocks simple.

==================================================

3. STOCK DETAILS

==================================================

Clicking a stock should open a detailed explanation.

Show:

- company name

- symbol

- current price

- percentage change

- Attention Score

- attention level

- Market Significance

- Personal Relevance

- price anomaly

- volume anomaly

- relative performance against benchmark

- volatility change if available

- relevant market event

- data freshness

- observation timestamp

The page must answer three questions clearly:

"What changed?"

"Why is it unusual?"

"Why is Nexora showing this to me?"

Example:

RELIANCE

₹1,376

-3.64%

HIGH ATTENTION

87 / 100

WHY THIS IS FLAGGED

Price movement

3.64%

4.1× typical movement

Volume

2.8× recent average

vs NIFTY

Reliance: -3.64%

NIFTY: -0.42%

Event

Quarterly result announced

Data

Fresh · 10:31 AM

Do NOT provide buy/sell recommendations or financial advice.

==================================================

4. SETTINGS

==================================================

Allow users to configure:

Attention Sensitivity

- Conservative

- Balanced

- Sensitive

Balanced should be the default.

Explain briefly how Attention Scores work.

Allow the user to select their default watchlist.

==================================================

5. MARKET DATA ARCHITECTURE

==================================================

Create a Market Data Adapter abstraction.

The UI and business logic must NOT depend directly on a specific market-data provider.

Initially implement:

DemoMarketDataProvider

This provider should use deterministic, realistic seeded market data.

The architecture should make it possible to add:

LiveMarketDataProvider

later without changing the Attention Engine.

The normalized market-data model should include:

- symbol

- company name

- price

- change percentage

- volume

- average volume

- volatility

- benchmark change

- sector change

- observed_at

- source

- freshness

==================================================

6. DEMO MARKET DATA

==================================================

The demo provider must support multiple scenarios.

Include:

1. Normal movement

2. Unusual price movement

3. Unusual volume

4. Price + volume anomaly

5. Strong relative performance

6. Weak relative performance

7. Corporate event

8. Stale data

9. Unchanged stock

Seed enough historical observations to calculate meaningful comparisons.

Do not make the demo look obviously fake.

Use realistic values and timestamps.

==================================================

7. DEMO MARKET SIMULATION

==================================================

Add a clearly labelled:

"Demo Mode"

control.

Provide a deterministic action such as:

"Simulate Market Update"

Before simulation:

RELIANCE ₹1,430

TCS ₹3,820

INFY ₹1,540

After simulation:

RELIANCE ₹1,376

TCS ₹3,896

INFY ₹1,542

The exact values can differ, but the simulation must produce predictable meaningful changes.

After the simulation:

1. update market state

2. create a new snapshot

3. run change detection

4. calculate significance

5. calculate attention

6. update the dashboard

The evaluator must be able to see Nexora's main functionality without relying on real-time market movement.

Clearly label simulated data so it is never mistaken for live market data.

==================================================

8. CHANGE DETECTION

==================================================

Nexora must compare the current market state against the user's previous known state / last visit.

Do NOT define meaningful change using only a fixed percentage threshold.

Consider multiple signals:

- price anomaly

- volume anomaly

- relative performance

- volatility change

- event importance

A stock can be objectively significant without necessarily being personally relevant to a user.

Keep these concepts separate.

Calculate:

Market Significance

Personal Relevance

Attention Score

==================================================

9. ATTENTION ENGINE

==================================================

Implement a deterministic Attention Score from 0–100.

Initial weighting:

Price Anomaly: 35%

Volume Anomaly: 25%

Relative Performance: 20%

Volatility Change: 10%

Event Importance: 10%

Normalize the individual signals before combining them.

Classify:

80–100 = High Attention

60–79 = Medium Attention

40–59 = Low Attention

0–39 = Normal

Personal Relevance should initially be based on watchlist priority.

A High Priority stock should receive a relevance boost.

Attention sensitivity should modify the threshold at which changes are surfaced, rather than changing the underlying market facts.

The scoring engine must be:

- deterministic

- explainable

- testable

- independent from the UI

Do not use machine learning.

Do not use an LLM to determine whether a stock is meaningful.

==================================================

10. EXPLANATION ENGINE

==================================================

Explanations must be based only on calculated facts.

Never generate unsupported financial claims.

For example:

"RELIANCE moved 3.6%, which is 4.1× its typical movement, while volume is 2.8× its recent average."

The explanation should identify the actual signals contributing to the Attention Score.

Create explanation data structurally so the UI can display individual reasons.

For example:

[

  {

    signal: "PRICE_ANOMALY",

    label: "Unusual price movement",

    value: "4.1× typical movement"

  },

  {

    signal: "VOLUME_ANOMALY",

    label: "Elevated volume",

    value: "2.8× recent average"

  }

]

==================================================

11. MARKET EVENTS

==================================================

Support simple events:

- earnings/results

- dividend

- stock split

- bonus

- major company announcement

Each event should contain:

- symbol

- event_type

- title

- description

- importance

- event_time

Avoid duplicate events.

Events should contribute to Attention Score when appropriate.

==================================================

12. DATA FRESHNESS

==================================================

Every market observation must contain:

- observed_at

- source

- freshness

Support:

Fresh

Delayed

Stale

Use reasonable thresholds for the demo.

Never display stale information as if it were current.

If market data is unavailable:

- show the last known value

- show the timestamp

- clearly display that the data is stale

- provide a retry action where appropriate

If the market is closed, make that clear rather than treating unchanged prices as missing data.

==================================================

13. USER STATE

==================================================

Persist user state server-side.

Track the user's last meaningful dashboard visit / last-seen state.

The same ongoing movement should NOT repeatedly appear as a completely new change after every refresh.

Use change states:

NEW

SEEN

ACKNOWLEDGED

For the MVP, the UI only needs:

NEW

SEEN

The backend should be structured so ACKNOWLEDGED can be supported later.

==================================================

14. DATABASE

==================================================

Use Supabase PostgreSQL.

Create these tables:

profiles

- id

- display_name

- last_seen_at

- attention_sensitivity

- created_at

watchlists

- id

- user_id

- name

- created_at

- updated_at

watchlist_items

- id

- watchlist_id

- symbol

- priority

- added_at

market_snapshots

- id

- symbol

- price

- change_percent

- volume

- avg_volume

- volatility

- benchmark_change

- sector_change

- observed_at

- source

- freshness

market_events

- id

- symbol

- event_type

- title

- description

- importance

- event_time

attention_events

- id

- user_id

- symbol

- snapshot_id

- attention_score

- market_significance

- personal_relevance

- status

- detected_at

Use:

- primary keys

- foreign keys

- unique constraints where appropriate

- useful indexes

Prevent duplicate watchlist items.

==================================================

15. AUTHENTICATION AND SECURITY

==================================================

Use Supabase Authentication.

Users should have their own account and own watchlists.

Use Row Level Security.

Users must only be able to access and modify their own:

- profile

- watchlists

- watchlist items

- attention events

Do not expose another user's data.

Keep authorization rules server-side.

==================================================

16. ERROR HANDLING

==================================================

Handle:

- failed database requests

- missing market data

- stale market data

- duplicate stocks

- empty watchlists

- invalid symbols

- no meaningful changes

- repeated events

- simulation failures

- concurrent refreshes where practical

Do not silently fail.

Use clear user-facing messages and retry actions.

==================================================

17. MAIN NAVIGATION

==================================================

Create a simple navigation structure:

Dashboard

Watchlist

Settings

Stock Details should open from the Dashboard or Watchlist.

Keep navigation simple.

==================================================

18. UX / VISUAL DESIGN

==================================================

Create an original modern financial-product interface.

The visual hierarchy should prioritize:

1. What changed?

2. What deserves attention?

3. Why?

4. Supporting market information

Use:

- clean typography

- whitespace

- readable financial numbers

- clear attention states

- restrained cards

- responsive layout

- subtle interactions

Avoid:

- excessive gradients

- excessive animations

- visual clutter

- generic AI-chat interfaces

- copying Groww's interface

Nexora should feel like a serious financial technology product.

==================================================

19. CODE QUALITY

==================================================

Use:

- TypeScript types/interfaces

- reusable components

- clear naming

- small functions

- centralized business logic

- separation of data access and business logic

- testable scoring functions

Do not duplicate Attention Engine logic across UI components.

The Attention Engine should be usable independently from the frontend.

==================================================

20. ARCHITECTURE

==================================================

Use a modular monolith.

Conceptually:

Frontend

    ↓

API / Data Layer

    ↓

--------------------------------

| Watchlist Module             |

| Market Data Module           |

| Snapshot Module              |

| Change Detection Module      |

| Significance Module          |

| Attention Module             |

| Event Module                 |

--------------------------------

    ↓

PostgreSQL

Market Data:

Market Data Adapter

       |

       ├── Demo Provider

       └── Future Live Provider

Do NOT create microservices.

Do NOT introduce infrastructure that is unnecessary for a one-day engineering challenge.

==================================================

21. INITIAL SEEDED DEMO STATE

==================================================

When the application is first opened in demo mode, it should have enough data to demonstrate the product immediately.

Include:

- several normal stocks

- at least one high-attention stock

- at least one medium-attention stock

- at least one corporate event

- at least one stale observation

- several unchanged stocks

The evaluator should understand the product within approximately 30 seconds.

==================================================

22. IMPORTANT PRODUCT BOUNDARIES

==================================================

Nexora is NOT:

- a trading platform

- a stock prediction engine

- a buy/sell recommendation system

- a brokerage

- a portfolio manager

- an AI chatbot

- a news aggregator

Nexora is:

"A temporal market intelligence layer that turns a passive watchlist into an attention system."

Its core loop is:

TRACK

→ DETECT

→ SCORE

→ EXPLAIN

==================================================

23. IMPLEMENTATION PRIORITY

==================================================

P0 — MUST WORK:

1. Authentication

2. Watchlist creation

3. Add/remove stocks

4. Market data display

5. Historical snapshots

6. Change detection

7. Attention Score

8. Since-last-visit dashboard

9. Explanation of meaningful changes

10. Persistent user state

P1:

11. Corporate events

12. High-priority stocks

13. Fresh/delayed/stale states

14. Attention sensitivity

P2 — ONLY IF TIME REMAINS:

15. Market timeline

16. Additional charts

17. Live market-data provider

18. Advanced animations

Do not sacrifice P0 functionality for P2 features.

==================================================

24. FIRST IMPLEMENTATION

==================================================

For this first build, create:

- complete application foundation

- Supabase integration

- database schema

- authentication structure

- navigation

- Dashboard shell

- Watchlist page

- Stock Details page

- Settings page

- Demo Market Data Provider

- seeded demo data

- Attention Engine foundation

- responsive UI

Do not add unrelated functionality.

After implementation:

- verify the application builds

- verify TypeScript has no obvious errors

- verify database relationships

- verify authentication structure

- verify the dashboard loads

- verify seeded demo data appears

- verify the application does not depend on a paid API

Do not move on to advanced features until the foundation is working.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nexoragroww.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/69dc658c-fa58-4458-be0d-a9ab8c2a3e47).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
