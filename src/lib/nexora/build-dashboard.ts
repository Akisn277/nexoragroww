import {
  computeAttention,
  isSurfaced,
  type AttentionResult,
  type Priority,
  type Sensitivity,
} from "@/lib/attention/engine";
import { freshnessFor, type MarketEventRecord, type MarketObservation } from "@/lib/market/types";

export interface WatchedSymbol {
  symbol: string;
  priority: Priority;
}

export interface ChangeItem {
  symbol: string;
  companyName: string;
  price: number;
  changePercent: number;
  freshness: MarketObservation["freshness"];
  observedAt: string;
  source: string;
  attention: AttentionResult;
  event: MarketEventRecord | null;
  status: "NEW" | "SEEN" | "ACKNOWLEDGED";
  snapshotId: string;
}

export interface DashboardModel {
  meaningful: ChangeItem[];
  unchangedCount: number;
  unchanged: { symbol: string; companyName: string; price: number; changePercent: number }[];
  missingSymbols: string[];
  staleCount: number;
  latestObservedAt: string | null;
  newCount: number;
}

export interface BuildDashboardInput {
  watched: WatchedSymbol[];
  /** Latest observation per symbol, keyed by symbol. */
  observations: Map<string, MarketObservation & { snapshotId: string }>;
  /** Previous observation per symbol (for volatility change). */
  previousObservations: Map<string, MarketObservation>;
  /** Most recent relevant event per symbol. */
  events: Map<string, MarketEventRecord>;
  sensitivity: Sensitivity;
  /** Snapshot ids already recorded as seen for this user. */
  seenSnapshotIds?: Set<string>;
  now?: Date;
}

/** Pure: turns raw market state + user state into the dashboard model. */
export function buildDashboard(input: BuildDashboardInput): DashboardModel {
  const now = input.now ?? new Date();
  const meaningful: ChangeItem[] = [];
  const unchanged: DashboardModel["unchanged"] = [];
  const missingSymbols: string[] = [];
  let staleCount = 0;
  let latest: string | null = null;

  for (const watched of input.watched) {
    const observation = input.observations.get(watched.symbol);
    if (!observation) {
      missingSymbols.push(watched.symbol);
      continue;
    }
    const freshness = freshnessFor(observation.observedAt, now);
    if (freshness === "stale") staleCount += 1;
    if (!latest || observation.observedAt > latest) latest = observation.observedAt;

    const event = input.events.get(watched.symbol) ?? null;
    const attention = computeAttention({
      observation: { ...observation, freshness },
      previousObservation: input.previousObservations.get(watched.symbol) ?? null,
      event,
      priority: watched.priority,
    });

    if (isSurfaced(attention.attentionScore, input.sensitivity)) {
      meaningful.push({
        symbol: observation.symbol,
        companyName: observation.companyName,
        price: observation.price,
        changePercent: observation.changePercent,
        freshness,
        observedAt: observation.observedAt,
        source: observation.source,
        attention,
        event,
        status: input.seenSnapshotIds?.has(observation.snapshotId) ? "SEEN" : "NEW",
        snapshotId: observation.snapshotId,
      });
    } else {
      unchanged.push({
        symbol: observation.symbol,
        companyName: observation.companyName,
        price: observation.price,
        changePercent: observation.changePercent,
      });
    }
  }

  meaningful.sort(
    (a, b) => b.attention.attentionScore - a.attention.attentionScore || a.symbol.localeCompare(b.symbol),
  );

  return {
    meaningful,
    unchanged,
    unchangedCount: unchanged.length,
    missingSymbols,
    staleCount,
    latestObservedAt: latest,
    newCount: meaningful.filter((m) => m.status === "NEW").length,
  };
}
