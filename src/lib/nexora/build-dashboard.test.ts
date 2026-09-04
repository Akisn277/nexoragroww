import { describe, expect, it } from "vitest";

import { buildDashboard, type BuildDashboardInput } from "./build-dashboard";
import type { MarketObservation } from "@/lib/market/types";

type DashboardObservation = MarketObservation & { snapshotId: string };

const now = new Date("2026-09-04T12:00:00.000Z");
const boundary = "2026-09-04T10:00:00.000Z";
const baselineTime = "2026-09-04T09:00:00.000Z";

const baseObservation: MarketObservation = {
  symbol: "NEXORA",
  companyName: "Nexora Industries",
  price: 100,
  changePercent: 0.2,
  volume: 1_000,
  avgVolume: 1_000,
  volatility: 1,
  benchmarkChange: 0.1,
  sectorChange: 0.1,
  observedAt: boundary,
  source: "demo-seed",
  freshness: "fresh",
};

function observation(
  overrides: Partial<MarketObservation> & { snapshotId?: string } = {},
): DashboardObservation {
  const { snapshotId = "snapshot-current", ...changes } = overrides;
  return {
    ...baseObservation,
    ...changes,
    snapshotId,
  };
}

function dashboardInput(
  current: DashboardObservation,
  overrides: Partial<BuildDashboardInput> = {},
): BuildDashboardInput {
  return {
    watched: [{ symbol: current.symbol, priority: "normal" }],
    observations: new Map([[current.symbol, current]]),
    previousObservations: new Map([
      [
        current.symbol,
        {
          ...current,
          observedAt: baselineTime,
          snapshotId: undefined,
        } as MarketObservation,
      ],
    ]),
    events: new Map(),
    sensitivity: "balanced",
    now,
    ...overrides,
  };
}

describe("buildDashboard temporal behavior", () => {
  it("surfaces the latest available meaningful state on a first visit", () => {
    const result = buildDashboard(
      dashboardInput(observation({ changePercent: 5, volume: 5_000, observedAt: boundary }), {
        since: null,
      }),
    );

    expect(result.meaningful).toHaveLength(1);
    expect(result.meaningful[0]?.snapshotId).toBe("snapshot-current");
    expect(result.unchanged).toHaveLength(0);
  });

  it("does not surface a stock when last_seen_at is after its latest observation", () => {
    const result = buildDashboard(
      dashboardInput(
        observation({ observedAt: "2026-09-04T09:59:00.000Z", changePercent: 5, volume: 5_000 }),
        { since: boundary },
      ),
    );

    expect(result.meaningful).toHaveLength(0);
    expect(result.unchanged).toHaveLength(1);
  });

  it("surfaces a strong observation that occurs after last_seen_at", () => {
    const result = buildDashboard(
      dashboardInput(
        observation({
          observedAt: "2026-09-04T10:30:00.000Z",
          changePercent: 5,
          volume: 5_000,
        }),
        { since: boundary },
      ),
    );

    expect(result.meaningful).toHaveLength(1);
    expect(result.meaningful[0]?.observedAt).toBe("2026-09-04T10:30:00.000Z");
  });

  it("uses the latest post-boundary observation with the pre-boundary baseline", () => {
    const latestPostBoundary = observation({
      snapshotId: "snapshot-latest",
      observedAt: "2026-09-04T11:30:00.000Z",
      price: 108,
      changePercent: 5,
      volume: 5_000,
    });
    const result = buildDashboard(
      dashboardInput(latestPostBoundary, {
        since: boundary,
        previousObservations: new Map([
          [
            "NEXORA",
            {
              ...baseObservation,
              observedAt: baselineTime,
              price: 100,
              changePercent: 0.2,
              volatility: 0.8,
            },
          ],
        ]),
      }),
    );

    expect(result.meaningful[0]?.snapshotId).toBe("snapshot-latest");
    expect(result.meaningful[0]?.attention.metrics.volatilityChangeRatio).toBe(1.25);
  });

  it("keeps observations at the boundary or earlier out of new changes", () => {
    const result = buildDashboard(
      dashboardInput(observation({ observedAt: boundary, changePercent: 5, volume: 5_000 }), {
        since: boundary,
      }),
    );

    expect(result.meaningful).toHaveLength(0);
    expect(result.unchanged.map((item) => item.symbol)).toEqual(["NEXORA"]);
  });

  it("keeps a stock with no new observation in unchanged", () => {
    const result = buildDashboard({
      watched: [
        { symbol: "NEXORA", priority: "normal" },
        { symbol: "OTHER", priority: "normal" },
      ],
      observations: new Map([["NEXORA", observation({ observedAt: "2026-09-04T09:30:00.000Z" })]]),
      previousObservations: new Map(),
      events: new Map(),
      sensitivity: "balanced",
      since: boundary,
      now,
    });

    expect(result.unchanged.map((item) => item.symbol)).toEqual(["NEXORA"]);
    expect(result.missingSymbols).toEqual(["OTHER"]);
  });

  it("retains stale classification for a new stale observation", () => {
    const result = buildDashboard(
      dashboardInput(
        observation({
          observedAt: "2026-09-04T08:00:00.000Z",
          changePercent: 5,
          volume: 5_000,
        }),
        { since: "2026-09-04T07:00:00.000Z" },
      ),
    );

    expect(result.staleCount).toBe(1);
    expect(result.meaningful[0]?.freshness).toBe("stale");
  });

  it("reports missing observations without crashing", () => {
    const result = buildDashboard({
      watched: [{ symbol: "NEXORA", priority: "normal" }],
      observations: new Map(),
      previousObservations: new Map(),
      events: new Map(),
      sensitivity: "balanced",
      since: boundary,
      now,
    });

    expect(result.missingSymbols).toEqual(["NEXORA"]);
    expect(result.meaningful).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it("uses sensitivity thresholds when deciding whether a new result is surfaced", () => {
    const current = observation({
      observedAt: "2026-09-04T10:30:00.000Z",
      changePercent: 1.6,
      volume: 1_500,
    });
    const sensitive = buildDashboard(
      dashboardInput(current, { since: boundary, sensitivity: "sensitive" }),
    );
    const balanced = buildDashboard(
      dashboardInput(current, { since: boundary, sensitivity: "balanced" }),
    );

    expect(sensitive.meaningful).toHaveLength(1);
    expect(balanced.meaningful).toHaveLength(0);
    expect(sensitive.unchanged).toHaveLength(0);
    expect(balanced.unchanged).toHaveLength(1);
  });
});
