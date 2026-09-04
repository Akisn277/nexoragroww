import { describe, expect, it } from "vitest";

import {
  computeAttention,
  isSurfaced,
  SENSITIVITY_THRESHOLDS,
  type AttentionInput,
} from "./engine";

const baseObservation = {
  symbol: "NEXORA",
  companyName: "Nexora Industries",
  price: 100,
  changePercent: 0.2,
  volume: 1_000,
  avgVolume: 1_000,
  volatility: 1,
  benchmarkChange: 0.1,
  sectorChange: 0.1,
  observedAt: "2026-09-04T10:00:00.000Z",
  source: "test",
  freshness: "fresh" as const,
};

function input(overrides: Partial<AttentionInput> = {}): AttentionInput {
  return {
    observation: baseObservation,
    ...overrides,
  };
}

describe("computeAttention", () => {
  it("returns normal attention for ordinary market movement", () => {
    const result = computeAttention(input());

    expect(result.level).toBe("NORMAL");
    expect(result.attentionScore).toBeLessThan(40);
  });

  it("increases attention for a strong price anomaly", () => {
    const normal = computeAttention(input());
    const anomalous = computeAttention(
      input({
        observation: { ...baseObservation, changePercent: 5 },
      }),
    );

    expect(anomalous.attentionScore).toBeGreaterThan(normal.attentionScore);
    expect(anomalous.reasons.some((reason) => reason.signal === "PRICE_ANOMALY")).toBe(true);
  });

  it("increases attention for a strong volume anomaly", () => {
    const normal = computeAttention(input());
    const anomalous = computeAttention(
      input({
        observation: { ...baseObservation, volume: 5_000 },
      }),
    );

    expect(anomalous.attentionScore).toBeGreaterThan(normal.attentionScore);
    expect(anomalous.reasons.some((reason) => reason.signal === "VOLUME_ANOMALY")).toBe(true);
  });

  it("increases attention for a significant market event", () => {
    const withoutEvent = computeAttention(input());
    const withEvent = computeAttention(
      input({
        event: {
          symbol: "NEXORA",
          eventType: "earnings",
          title: "Quarterly results announced",
          description: "Results published.",
          importance: "high",
          eventTime: "2026-09-04T09:30:00.000Z",
        },
      }),
    );

    expect(withEvent.attentionScore).toBeGreaterThan(withoutEvent.attentionScore);
    expect(withEvent.reasons.some((reason) => reason.signal === "EVENT_IMPORTANCE")).toBe(true);
  });

  it("gives high-priority stocks more relevance and attention", () => {
    const normal = computeAttention(input({ priority: "normal" }));
    const high = computeAttention(input({ priority: "high" }));

    expect(high.personalRelevance).toBeGreaterThan(normal.personalRelevance);
    expect(high.attentionScore).toBeGreaterThanOrEqual(normal.attentionScore);
  });

  it("handles missing optional signals without crashing", () => {
    const result = computeAttention(
      input({
        previousObservation: null,
        event: null,
      }),
    );

    expect(result.metrics.volatilityChangeRatio).toBeNull();
    expect(result.attentionScore).toBeGreaterThanOrEqual(0);
  });

  it("keeps the attention score within the 0 to 100 range", () => {
    const result = computeAttention(
      input({
        observation: {
          ...baseObservation,
          changePercent: 100,
          volume: 1_000_000,
        },
        priority: "high",
      }),
    );

    expect(result.attentionScore).toBeGreaterThanOrEqual(0);
    expect(result.attentionScore).toBeLessThanOrEqual(100);
  });

  it("respects the exposed sensitivity thresholds", () => {
    expect(SENSITIVITY_THRESHOLDS.conservative).toBe(65);
    expect(SENSITIVITY_THRESHOLDS.balanced).toBe(50);
    expect(SENSITIVITY_THRESHOLDS.sensitive).toBe(35);

    const result = computeAttention(
      input({ observation: { ...baseObservation, changePercent: 5, volume: 5_000 } }),
    );
    expect(isSurfaced(result.attentionScore, "sensitive")).toBe(true);
    expect(isSurfaced(result.attentionScore, "conservative")).toBe(result.attentionScore >= 65);
  });
});