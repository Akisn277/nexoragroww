import type { MarketDataProvider, MarketObservation } from "./types";

/**
 * Deterministic demo market-data provider.
 *
 * Given the same (symbol, step) it always produces the same observation, so
 * "Simulate Market Update" is reproducible and the Attention Engine can be
 * tested without any external market-data API.
 */

export type DemoScenario =
  | "normal"
  | "price_anomaly"
  | "volume_anomaly"
  | "price_volume_anomaly"
  | "strong_relative"
  | "weak_relative"
  | "event_driven"
  | "stale"
  | "unchanged";

const SCENARIO_CYCLE: DemoScenario[] = [
  "price_volume_anomaly",
  "price_anomaly",
  "unchanged",
  "event_driven",
  "normal",
  "volume_anomaly",
  "strong_relative",
  "unchanged",
  "weak_relative",
  "normal",
  "unchanged",
  "stale",
  "normal",
  "volume_anomaly",
  "strong_relative",
];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

interface ScenarioShape {
  /** Move expressed as a multiple of the instrument's typical daily move. */
  moveMultiple: number;
  volumeMultiple: number;
  /** Extra move applied only to this stock (relative performance). */
  relativeBias: number;
  staleMinutes: number;
}

function shapeFor(scenario: DemoScenario, jitter: number): ScenarioShape {
  switch (scenario) {
    case "price_volume_anomaly":
      return { moveMultiple: -3.6 - jitter, volumeMultiple: 2.6 + jitter, relativeBias: 0, staleMinutes: 4 };
    case "price_anomaly":
      return { moveMultiple: 2.4 + jitter, volumeMultiple: 1.2 + jitter * 0.3, relativeBias: 0, staleMinutes: 4 };
    case "volume_anomaly":
      return { moveMultiple: 0.7, volumeMultiple: 3.1 + jitter, relativeBias: 0, staleMinutes: 5 };
    case "strong_relative":
      return { moveMultiple: 1.9 + jitter * 0.4, volumeMultiple: 1.4, relativeBias: 1.1, staleMinutes: 5 };
    case "weak_relative":
      return { moveMultiple: -1.8 - jitter * 0.4, volumeMultiple: 1.3, relativeBias: -1.0, staleMinutes: 5 };
    case "event_driven":
      return { moveMultiple: 0.8 + jitter * 0.2, volumeMultiple: 1.5, relativeBias: 0, staleMinutes: 6 };
    case "stale":
      return { moveMultiple: -0.35, volumeMultiple: 1.02, relativeBias: 0, staleMinutes: 190 };
    case "unchanged":
      return { moveMultiple: 0.12, volumeMultiple: 1.01, relativeBias: 0, staleMinutes: 6 };
    case "normal":
    default:
      return { moveMultiple: 0.45 - jitter * 0.5, volumeMultiple: 1.05, relativeBias: 0, staleMinutes: 6 };
  }
}

export function scenarioFor(symbol: string, step: number): DemoScenario {
  const offset = Math.floor(hash(symbol) * SCENARIO_CYCLE.length);
  const index = (offset + step) % SCENARIO_CYCLE.length;
  return SCENARIO_CYCLE[index] ?? "normal";
}

export class DemoMarketDataProvider implements MarketDataProvider {
  readonly id = "demo";
  readonly label = "Demo (simulated)";
  readonly isSimulated = true;

  nextObservations(previous: MarketObservation[], step: number): MarketObservation[] {
    const now = Date.now();
    // Benchmark move is shared across symbols in one simulated update.
    const benchmarkChange = round(-0.42 + (hash(`nifty:${step}`) - 0.5) * 1.4);

    return previous.map((prev) => {
      const jitter = hash(`${prev.symbol}:${step}`) * 0.8;
      const scenario = scenarioFor(prev.symbol, step);
      const shape = shapeFor(scenario, jitter);
      const typical = Math.max(prev.volatility, 0.2);
      const changePercent = round(typical * shape.moveMultiple + shape.relativeBias);
      const price = round(prev.price * (1 + changePercent / 100));
      const volume = Math.round(prev.avgVolume * shape.volumeMultiple);
      const volatility = round(Math.max(0.2, typical * (0.94 + jitter * 0.14)));
      const observedAt = new Date(now - shape.staleMinutes * 60_000).toISOString();

      return {
        symbol: prev.symbol,
        companyName: prev.companyName,
        price,
        changePercent,
        volume,
        avgVolume: prev.avgVolume,
        volatility,
        benchmarkChange,
        sectorChange: round(benchmarkChange + (hash(`${prev.symbol}:sector:${step}`) - 0.5) * 1.2),
        observedAt,
        source: "demo-simulation",
        freshness: shape.staleMinutes <= 10 ? "fresh" : shape.staleMinutes <= 30 ? "delayed" : "stale",
      } satisfies MarketObservation;
    });
  }
}

/** Single place where the active provider is chosen. */
export function getMarketDataProvider(): MarketDataProvider {
  return new DemoMarketDataProvider();
}
