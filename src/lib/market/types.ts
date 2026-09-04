/**
 * Normalized market-data model. Business logic and UI depend ONLY on these
 * types — never on a specific market-data provider.
 */

export type Freshness = "fresh" | "delayed" | "stale";

export type MarketEventType = "earnings" | "dividend" | "split" | "bonus" | "announcement";

export type EventImportance = "low" | "medium" | "high";

export interface MarketObservation {
  symbol: string;
  companyName: string;
  /** Last traded price, in INR. */
  price: number;
  /** Session change, in percent. */
  changePercent: number;
  volume: number;
  /** Recent average traded volume, used as the volume baseline. */
  avgVolume: number;
  /** Typical absolute daily move, in percent. Used as the price baseline. */
  volatility: number;
  /** Benchmark (NIFTY) change for the same window, in percent. */
  benchmarkChange: number;
  /** Sector change for the same window, in percent. */
  sectorChange: number;
  observedAt: string;
  source: string;
  freshness: Freshness;
}

export interface MarketEventRecord {
  symbol: string;
  eventType: MarketEventType;
  title: string;
  description: string | null;
  importance: EventImportance;
  eventTime: string;
}

export interface MarketDataProvider {
  readonly id: string;
  readonly label: string;
  /** True when values are simulated and must be labelled as such in the UI. */
  readonly isSimulated: boolean;
  /**
   * Produce the next observation for each symbol given its latest known
   * observation. Must be deterministic for a given (symbol, step).
   */
  nextObservations(previous: MarketObservation[], step: number): MarketObservation[];
}

export const FRESHNESS_THRESHOLDS_MINUTES = { fresh: 10, delayed: 30 } as const;

export function freshnessFor(observedAt: string, now: Date = new Date()): Freshness {
  const minutes = (now.getTime() - new Date(observedAt).getTime()) / 60_000;
  if (minutes <= FRESHNESS_THRESHOLDS_MINUTES.fresh) return "fresh";
  if (minutes <= FRESHNESS_THRESHOLDS_MINUTES.delayed) return "delayed";
  return "stale";
}
