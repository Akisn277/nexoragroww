import type { EventImportance, MarketEventRecord, MarketObservation } from "@/lib/market/types";

/**
 * Attention Engine — deterministic, explainable, UI-independent.
 *
 * Market Significance answers "is this objectively unusual?".
 * Personal Relevance answers "does this matter to THIS user?".
 * Attention Score combines them into a single 0-100 ranking value.
 */

export type SignalKey =
  | "PRICE_ANOMALY"
  | "VOLUME_ANOMALY"
  | "RELATIVE_PERFORMANCE"
  | "VOLATILITY_CHANGE"
  | "EVENT_IMPORTANCE";

export type AttentionLevel = "HIGH" | "MEDIUM" | "LOW" | "NORMAL";

export type Sensitivity = "conservative" | "balanced" | "sensitive";

export type Priority = "normal" | "high";

export const SIGNAL_WEIGHTS: Record<SignalKey, number> = {
  PRICE_ANOMALY: 0.35,
  VOLUME_ANOMALY: 0.25,
  RELATIVE_PERFORMANCE: 0.2,
  VOLATILITY_CHANGE: 0.1,
  EVENT_IMPORTANCE: 0.1,
};

/** Minimum attention score at which a change is surfaced on the dashboard. */
export const SENSITIVITY_THRESHOLDS: Record<Sensitivity, number> = {
  conservative: 65,
  balanced: 50,
  sensitive: 35,
};

const EVENT_IMPORTANCE_SCORE: Record<EventImportance, number> = {
  low: 0.35,
  medium: 0.65,
  high: 1,
};

export interface AttentionReason {
  signal: SignalKey;
  label: string;
  value: string;
  /** Normalized signal strength, 0-1. */
  strength: number;
  /** Points this signal contributed to Market Significance (0-100 scale). */
  contribution: number;
}

export interface AttentionMetrics {
  /** |change| expressed as a multiple of the typical daily move. */
  priceMoveMultiple: number;
  /** volume / avg volume. */
  volumeMultiple: number;
  /** Gap vs benchmark, in percentage points. */
  relativeGap: number;
  /** Gap vs benchmark expressed as a multiple of the typical daily move. */
  relativeGapMultiple: number;
  /** Change in typical daily move vs the previous observation, as a ratio. */
  volatilityChangeRatio: number | null;
}

export interface AttentionResult {
  symbol: string;
  marketSignificance: number;
  personalRelevance: number;
  attentionScore: number;
  level: AttentionLevel;
  reasons: AttentionReason[];
  metrics: AttentionMetrics;
  /** One-sentence summary built strictly from the reasons above. */
  summary: string;
}

export interface AttentionInput {
  observation: MarketObservation;
  previousObservation?: MarketObservation | null;
  event?: MarketEventRecord | null;
  priority?: Priority;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Normalizes an "x times baseline" ratio into 0-1. 1x baseline scores 0. */
function normalizeMultiple(multiple: number, span = 1.2): number {
  if (!Number.isFinite(multiple)) return 0;
  return clamp01((multiple - 1) / span);
}

function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function levelFor(score: number): AttentionLevel {
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  if (score >= 40) return "LOW";
  return "NORMAL";
}

export function computeAttention(input: AttentionInput): AttentionResult {
  const { observation, previousObservation, event, priority = "normal" } = input;

  const typicalMove = Math.max(Math.abs(observation.volatility), 0.2);
  const absChange = Math.abs(observation.changePercent);
  const priceMoveMultiple = round(absChange / typicalMove);

  const volumeMultiple =
    observation.avgVolume > 0 ? round(observation.volume / observation.avgVolume) : 1;

  const relativeGap = round(observation.changePercent - observation.benchmarkChange);
  const relativeGapMultiple = round(Math.abs(relativeGap) / typicalMove);

  const prevVolatility = previousObservation ? Math.abs(previousObservation.volatility) : null;
  const volatilityChangeRatio =
    prevVolatility && prevVolatility > 0 ? round(typicalMove / prevVolatility) : null;

  const strengths: Record<SignalKey, number | null> = {
    PRICE_ANOMALY: normalizeMultiple(priceMoveMultiple),
    VOLUME_ANOMALY: normalizeMultiple(volumeMultiple),
    RELATIVE_PERFORMANCE: normalizeMultiple(relativeGapMultiple),
    VOLATILITY_CHANGE:
      volatilityChangeRatio === null ? null : clamp01((Math.abs(volatilityChangeRatio - 1) - 0.1) / 0.5),
    EVENT_IMPORTANCE: event ? EVENT_IMPORTANCE_SCORE[event.importance] : null,
  };

  // Only signals we can actually observe take part in the weighted average.
  let weightSum = 0;
  let weighted = 0;
  for (const key of Object.keys(SIGNAL_WEIGHTS) as SignalKey[]) {
    const strength = strengths[key];
    if (strength === null) continue;
    weightSum += SIGNAL_WEIGHTS[key];
    weighted += SIGNAL_WEIGHTS[key] * strength;
  }
  const marketSignificance = weightSum > 0 ? Math.round((weighted / weightSum) * 100) : 0;

  // Personal Relevance is intentionally separate from market facts.
  const personalRelevance = priority === "high" ? 100 : 60;
  const relevanceMultiplier = priority === "high" ? 1.15 : 1;
  const attentionScore = Math.max(0, Math.min(100, Math.round(marketSignificance * relevanceMultiplier)));

  const reasons: AttentionReason[] = [];
  const push = (signal: SignalKey, label: string, value: string) => {
    const strength = strengths[signal];
    if (strength === null || strength <= 0.02) return;
    reasons.push({
      signal,
      label,
      value,
      strength: round(strength),
      contribution: Math.round((SIGNAL_WEIGHTS[signal] * strength * 100) / (weightSum || 1)),
    });
  };

  push("PRICE_ANOMALY", "Unusual price movement", `${priceMoveMultiple.toFixed(1)}× typical movement`);
  push("VOLUME_ANOMALY", "Elevated volume", `${volumeMultiple.toFixed(1)}× recent average`);
  push(
    "RELATIVE_PERFORMANCE",
    relativeGap >= 0 ? "Outperforming the benchmark" : "Underperforming the benchmark",
    `${relativeGap > 0 ? "+" : ""}${relativeGap.toFixed(2)} pts vs NIFTY`,
  );
  if (volatilityChangeRatio !== null) {
    push(
      "VOLATILITY_CHANGE",
      volatilityChangeRatio >= 1 ? "Volatility rising" : "Volatility easing",
      `${volatilityChangeRatio.toFixed(2)}× previous volatility`,
    );
  }
  if (event) push("EVENT_IMPORTANCE", "Market event", event.title);

  reasons.sort((a, b) => b.contribution - a.contribution);

  return {
    symbol: observation.symbol,
    marketSignificance,
    personalRelevance,
    attentionScore,
    level: levelFor(attentionScore),
    reasons,
    metrics: {
      priceMoveMultiple,
      volumeMultiple,
      relativeGap,
      relativeGapMultiple,
      volatilityChangeRatio,
    },
    summary: buildSummary(observation, reasons),
  };
}

/**
 * Explanation Engine: sentences are assembled only from computed facts.
 * No forecasts, no advice, no unsupported claims.
 */
export function buildSummary(observation: MarketObservation, reasons: AttentionReason[]): string {
  if (reasons.length === 0) {
    return `${observation.symbol} moved ${observation.changePercent.toFixed(2)}%, within its normal range.`;
  }
  const parts = reasons.slice(0, 3).map((reason) => {
    switch (reason.signal) {
      case "PRICE_ANOMALY":
        return `moved ${observation.changePercent.toFixed(2)}%, which is ${reason.value}`;
      case "VOLUME_ANOMALY":
        return `traded at ${reason.value} volume`;
      case "RELATIVE_PERFORMANCE":
        return `is ${reason.value}`;
      case "VOLATILITY_CHANGE":
        return `${reason.label.toLowerCase()} at ${reason.value}`;
      case "EVENT_IMPORTANCE":
        return `has an event: ${reason.value}`;
      default:
        return reason.value;
    }
  });
  return `${observation.symbol} ${parts.join(", and ")}.`;
}

export function isSurfaced(score: number, sensitivity: Sensitivity): boolean {
  return score >= SENSITIVITY_THRESHOLDS[sensitivity];
}
