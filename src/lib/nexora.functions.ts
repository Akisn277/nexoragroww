import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeAttention,
  SENSITIVITY_THRESHOLDS,
  type Priority,
  type Sensitivity,
} from "@/lib/attention/engine";
import { getMarketDataProvider, scenarioFor } from "@/lib/market/demo-provider";
import { INSTRUMENTS, findInstrument, isSupportedSymbol } from "@/lib/market/instruments";
import { freshnessFor, type MarketEventRecord, type MarketObservation } from "@/lib/market/types";
import { buildDashboard, type ChangeItem } from "@/lib/nexora/build-dashboard";

type SnapshotRow = {
  id: string;
  symbol: string;
  company_name: string;
  price: number;
  change_percent: number;
  volume: number;
  avg_volume: number;
  volatility: number;
  benchmark_change: number;
  sector_change: number;
  observed_at: string;
  source: string;
  freshness: "fresh" | "delayed" | "stale";
};

type EventRow = {
  symbol: string;
  event_type: MarketEventRecord["eventType"];
  title: string;
  description: string | null;
  importance: MarketEventRecord["importance"];
  event_time: string;
};

const SNAPSHOT_COLUMNS =
  "id, symbol, company_name, price, change_percent, volume, avg_volume, volatility, benchmark_change, sector_change, observed_at, source, freshness";

function toObservation(row: SnapshotRow): MarketObservation & { snapshotId: string } {
  return {
    snapshotId: row.id,
    symbol: row.symbol,
    companyName: row.company_name,
    price: Number(row.price),
    changePercent: Number(row.change_percent),
    volume: Number(row.volume),
    avgVolume: Number(row.avg_volume),
    volatility: Number(row.volatility),
    benchmarkChange: Number(row.benchmark_change),
    sectorChange: Number(row.sector_change),
    observedAt: row.observed_at,
    source: row.source,
    freshness: row.freshness,
  };
}

function toEvent(row: EventRow): MarketEventRecord {
  return {
    symbol: row.symbol,
    eventType: row.event_type,
    title: row.title,
    description: row.description,
    importance: row.importance,
    eventTime: row.event_time,
  };
}

function fail(message: string): never {
  throw new Error(message);
}

/** Latest + previous observation per symbol from a time-ordered snapshot list. */
function splitByRecency(rows: SnapshotRow[]) {
  const latest = new Map<string, MarketObservation & { snapshotId: string }>();
  const previous = new Map<string, MarketObservation>();
  for (const row of rows) {
    if (!latest.has(row.symbol)) latest.set(row.symbol, toObservation(row));
    else if (!previous.has(row.symbol)) previous.set(row.symbol, toObservation(row));
  }
  return { latest, previous };
}

async function loadDashboardObservations(
  supabase: any,
  symbols: string[],
  lastSeenAt: string | null,
) {
  if (!lastSeenAt) {
    const { data, error } = await supabase
      .from("market_snapshots")
      .select(SNAPSHOT_COLUMNS)
      .in("symbol", symbols)
      .order("observed_at", { ascending: false })
      .limit(symbols.length * 8);
    if (error) fail(`Could not load market data: ${error.message}`);
    return splitByRecency((data ?? []) as SnapshotRow[]);
  }

  const [newResult, baselineResult] = await Promise.all([
    supabase
      .from("market_snapshots")
      .select(SNAPSHOT_COLUMNS)
      .in("symbol", symbols)
      .gt("observed_at", lastSeenAt)
      .order("observed_at", { ascending: false }),
    supabase
      .from("market_snapshots")
      .select(SNAPSHOT_COLUMNS)
      .in("symbol", symbols)
      .lte("observed_at", lastSeenAt)
      .order("observed_at", { ascending: false }),
  ]);
  if (newResult.error) fail(`Could not load new market data: ${newResult.error.message}`);
  if (baselineResult.error) fail(`Could not load market baseline: ${baselineResult.error.message}`);

  const newObservations = splitByRecency((newResult.data ?? []) as SnapshotRow[]);
  const baseline = splitByRecency((baselineResult.data ?? []) as SnapshotRow[]);
  const latest = new Map(newObservations.latest);
  for (const [symbol, observation] of baseline.latest) {
    if (!latest.has(symbol)) latest.set(symbol, observation);
  }

  return { latest, previous: baseline.latest };
}

type Supa = Parameters<Parameters<typeof requireSupabaseAuth.server>[0]>[0] extends never
  ? never
  : never;

// ---------------------------------------------------------------- profile ---

async function loadProfile(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, last_seen_at, attention_sensitivity, default_watchlist_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) fail(`Could not load your profile: ${error.message}`);
  if (data) return data;

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: userId })
    .select("id, display_name, last_seen_at, attention_sensitivity, default_watchlist_id")
    .single();
  if (insertError) fail(`Could not create your profile: ${insertError.message}`);
  return created;
}

async function resolveWatchlist(supabase: any, userId: string, requested?: string | null) {
  const { data: watchlists, error } = await supabase
    .from("watchlists")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) fail(`Could not load your watchlists: ${error.message}`);
  return watchlists ?? [];
}

// -------------------------------------------------------------- dashboard ---

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ watchlistId: z.string().uuid().optional(), refreshToken: z.number().optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await loadProfile(supabase, userId);
    const watchlists = await resolveWatchlist(supabase, userId);

    const activeId =
      data.watchlistId ??
      (watchlists.some((w: any) => w.id === profile.default_watchlist_id)
        ? profile.default_watchlist_id
        : (watchlists[0]?.id ?? null));

    const serverNow = new Date().toISOString();
    const base = {
      profile,
      watchlists,
      activeWatchlistId: activeId,
      lastVisitAt: profile.last_seen_at as string | null,
      serverNow,
      provider: {
        label: getMarketDataProvider().label,
        isSimulated: getMarketDataProvider().isSimulated,
      },
      threshold: SENSITIVITY_THRESHOLDS[profile.attention_sensitivity as Sensitivity],
    };

    if (!activeId) {
      return { ...base, dashboard: null, itemCount: 0 };
    }

    const { data: items, error: itemsError } = await supabase
      .from("watchlist_items")
      .select("symbol, priority")
      .eq("watchlist_id", activeId);
    if (itemsError) fail(`Could not load watchlist items: ${itemsError.message}`);

    const watched = (items ?? []).map((i: any) => ({
      symbol: i.symbol as string,
      priority: i.priority as Priority,
    }));
    if (watched.length === 0) return { ...base, dashboard: null, itemCount: 0 };

    const symbols = watched.map((w) => w.symbol);
    const { latest, previous } = await loadDashboardObservations(
      supabase,
      symbols,
      profile.last_seen_at as string | null,
    );

    const { data: eventRows, error: eventError } = await supabase
      .from("market_events")
      .select("symbol, event_type, title, description, importance, event_time")
      .in("symbol", symbols)
      .gte("event_time", profile.last_seen_at ?? new Date(Date.now() - 24 * 3600_000).toISOString())
      .order("event_time", { ascending: false });
    if (eventError) fail(`Could not load market events: ${eventError.message}`);

    const events = new Map<string, MarketEventRecord>();
    for (const row of (eventRows ?? []) as EventRow[]) {
      if (!events.has(row.symbol)) events.set(row.symbol, toEvent(row));
    }

    const model = buildDashboard({
      watched,
      observations: latest,
      previousObservations: previous,
      events,
      sensitivity: profile.attention_sensitivity as Sensitivity,
      since: profile.last_seen_at as string | null,
    });

    // Persist detected changes so the same ongoing movement is not re-reported
    // as brand new on every refresh.
    if (model.meaningful.length > 0) {
      const snapshotIds = model.meaningful.map((m) => m.snapshotId);
      const { data: existing } = await supabase
        .from("attention_events")
        .select("snapshot_id, status")
        .eq("user_id", userId)
        .in("snapshot_id", snapshotIds);

      const statusBySnapshot = new Map<string, ChangeItem["status"]>(
        (existing ?? []).map((row: any) => [row.snapshot_id, row.status]),
      );

      const toInsert = model.meaningful
        .filter((m) => !statusBySnapshot.has(m.snapshotId))
        .map((m) => ({
          user_id: userId,
          symbol: m.symbol,
          snapshot_id: m.snapshotId,
          attention_score: m.attention.attentionScore,
          market_significance: m.attention.marketSignificance,
          personal_relevance: m.attention.personalRelevance,
          status: "NEW" as const,
        }));

      if (toInsert.length > 0) {
        // Safe under concurrent refreshes: unique(user_id, snapshot_id).
        await supabase
          .from("attention_events")
          .upsert(toInsert, { onConflict: "user_id,snapshot_id", ignoreDuplicates: true });
      }

      for (const item of model.meaningful) {
        item.status = statusBySnapshot.get(item.snapshotId) ?? "NEW";
      }
      model.newCount = model.meaningful.filter((m) => m.status === "NEW").length;
    }

    return { ...base, dashboard: model, itemCount: watched.length };
  });

export const markDashboardSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const seenAt = new Date().toISOString();
    const { error } = await supabase
      .from("attention_events")
      .update({ status: "SEEN" })
      .eq("user_id", userId)
      .eq("status", "NEW");
    if (error) fail(`Could not update change states: ${error.message}`);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ last_seen_at: seenAt })
      .eq("id", userId);
    if (profileError) fail(`Could not save your last visit: ${profileError.message}`);
    return { seenAt };
  });

// ------------------------------------------------------------- simulation ---

export const simulateMarketUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const symbols = INSTRUMENTS.map((i) => i.symbol);

    const { data: snapshots, error } = await supabase
      .from("market_snapshots")
      .select(SNAPSHOT_COLUMNS)
      .in("symbol", symbols)
      .order("observed_at", { ascending: false })
      .limit(symbols.length * 4);
    if (error) fail(`Simulation failed while reading market state: ${error.message}`);

    const { latest } = splitByRecency((snapshots ?? []) as SnapshotRow[]);
    if (latest.size === 0) fail("Simulation failed: no market state to advance.");

    const { count } = await supabase
      .from("market_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("source", "demo-simulation");
    const step = Math.floor((count ?? 0) / symbols.length) + 1;

    const provider = getMarketDataProvider();
    const next = provider.nextObservations([...latest.values()], step);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("last_seen_at")
      .eq("id", userId)
      .maybeSingle();
    if (profileError)
      fail(`Simulation failed while reading your visit state: ${profileError.message}`);
    const lastSeenAt = profile?.last_seen_at ? Date.parse(profile.last_seen_at) : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = next.map((o) => ({
      symbol: o.symbol,
      company_name: o.companyName,
      price: o.price,
      change_percent: o.changePercent,
      volume: o.volume,
      avg_volume: o.avgVolume,
      volatility: o.volatility,
      benchmark_change: o.benchmarkChange,
      sector_change: o.sectorChange,
      observed_at:
        lastSeenAt !== null && o.freshness !== "stale" && Date.parse(o.observedAt) <= lastSeenAt
          ? new Date(lastSeenAt + 1).toISOString()
          : o.observedAt,
      source: o.source,
      freshness: o.freshness,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("market_snapshots")
      .upsert(rows, { onConflict: "symbol,observed_at", ignoreDuplicates: true });
    if (insertError) fail(`Simulation failed while writing snapshots: ${insertError.message}`);

    // Deterministic corporate events for the event-driven scenario.
    const eventTime = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
    const eventRows = next
      .filter((o) => scenarioFor(o.symbol, step) === "event_driven")
      .map((o) => ({
        symbol: o.symbol,
        event_type: "earnings" as const,
        title: "Quarterly results announced",
        description: `${o.companyName} published quarterly results to the exchanges.`,
        importance: "high" as const,
        event_time: eventTime,
      }));
    if (eventRows.length > 0) {
      await supabaseAdmin
        .from("market_events")
        .upsert(eventRows, { onConflict: "symbol,event_type,event_time", ignoreDuplicates: true });
    }

    return { step, updated: rows.length, events: eventRows.length };
  });

// ----------------------------------------------------------- stock detail ---

export const getStockDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ symbol: z.string().min(1).max(20) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const symbol = data.symbol.trim().toUpperCase();
    if (!isSupportedSymbol(symbol)) fail(`${symbol} is not a supported symbol.`);

    const profile = await loadProfile(supabase, userId);

    const { data: rows, error } = await supabase
      .from("market_snapshots")
      .select(SNAPSHOT_COLUMNS)
      .eq("symbol", symbol)
      .order("observed_at", { ascending: false })
      .limit(10);
    if (error) fail(`Could not load market data for ${symbol}: ${error.message}`);
    const snapshots = (rows ?? []) as SnapshotRow[];
    if (snapshots.length === 0) fail(`No market observations recorded for ${symbol} yet.`);

    const observation = toObservation(snapshots[0]!);
    const previous = snapshots[1] ? toObservation(snapshots[1]!) : null;

    const { data: eventRows } = await supabase
      .from("market_events")
      .select("symbol, event_type, title, description, importance, event_time")
      .eq("symbol", symbol)
      .gte("event_time", new Date(Date.now() - 24 * 3600_000).toISOString())
      .order("event_time", { ascending: false })
      .limit(1);
    const event = eventRows && eventRows[0] ? toEvent(eventRows[0] as EventRow) : null;

    const { data: item } = await supabase
      .from("watchlist_items")
      .select("priority, watchlists!inner(user_id)")
      .eq("symbol", symbol)
      .eq("watchlists.user_id", userId)
      .order("priority", { ascending: false })
      .limit(1)
      .maybeSingle();

    const priority = ((item as any)?.priority ?? "normal") as Priority;
    const freshness = freshnessFor(observation.observedAt);
    const attention = computeAttention({
      observation: { ...observation, freshness },
      previousObservation: previous,
      event,
      priority,
    });

    return {
      instrument: findInstrument(symbol)!,
      observation: { ...observation, freshness },
      previous,
      event,
      priority,
      attention,
      inWatchlist: Boolean(item),
      sensitivity: profile.attention_sensitivity as Sensitivity,
      threshold: SENSITIVITY_THRESHOLDS[profile.attention_sensitivity as Sensitivity],
      history: snapshots.map((s) => ({
        observedAt: s.observed_at,
        price: Number(s.price),
        changePercent: Number(s.change_percent),
        volume: Number(s.volume),
        source: s.source,
      })),
      serverNow: new Date().toISOString(),
    };
  });

// -------------------------------------------------------------- watchlist ---

export const getWatchlistView = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ watchlistId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await loadProfile(supabase, userId);
    const watchlists = await resolveWatchlist(supabase, userId);
    const activeId =
      data.watchlistId ??
      (watchlists.some((w: any) => w.id === profile.default_watchlist_id)
        ? profile.default_watchlist_id
        : (watchlists[0]?.id ?? null));

    if (!activeId) {
      return {
        watchlists,
        activeWatchlistId: null,
        items: [],
        defaultWatchlistId: profile.default_watchlist_id,
      };
    }

    const { data: items, error } = await supabase
      .from("watchlist_items")
      .select("id, symbol, priority, added_at")
      .eq("watchlist_id", activeId)
      .order("added_at", { ascending: true });
    if (error) fail(`Could not load watchlist items: ${error.message}`);

    const symbols = (items ?? []).map((i: any) => i.symbol as string);
    const quotes = new Map<string, MarketObservation>();
    if (symbols.length > 0) {
      const { data: snapshots, error: snapError } = await supabase
        .from("market_snapshots")
        .select(SNAPSHOT_COLUMNS)
        .in("symbol", symbols)
        .order("observed_at", { ascending: false })
        .limit(symbols.length * 4);
      if (snapError) fail(`Could not load market data: ${snapError.message}`);
      const { latest } = splitByRecency((snapshots ?? []) as SnapshotRow[]);
      for (const [symbol, observation] of latest) {
        quotes.set(symbol, { ...observation, freshness: freshnessFor(observation.observedAt) });
      }
    }

    return {
      watchlists,
      activeWatchlistId: activeId,
      defaultWatchlistId: profile.default_watchlist_id,
      items: (items ?? []).map((i: any) => ({
        id: i.id as string,
        symbol: i.symbol as string,
        priority: i.priority as Priority,
        addedAt: i.added_at as string,
        companyName: findInstrument(i.symbol)?.companyName ?? i.symbol,
        sector: findInstrument(i.symbol)?.sector ?? "—",
        quote: quotes.get(i.symbol) ?? null,
      })),
    };
  });

export const createWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: created, error } = await supabase
      .from("watchlists")
      .insert({ user_id: userId, name: data.name })
      .select("id, name")
      .single();
    if (error) {
      if (
        error.code === "23505" ||
        error.code === "23P01" ||
        error.code === "23000" ||
        error.code === "23514"
      )
        fail(`Could not create the watchlist: ${error.message}`);
      if (error.code === "23499" || error.code === "23503") fail("Could not create the watchlist.");
      fail(
        error.code === "23000" || error.message.includes("duplicate")
          ? `You already have a watchlist named "${data.name}".`
          : `Could not create the watchlist: ${error.message}`,
      );
    }
    return created;
  });

export const renameWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ watchlistId: z.string().uuid(), name: z.string().trim().min(1).max(60) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("watchlists")
      .update({ name: data.name, updated_at: new Date().toISOString() })
      .eq("id", data.watchlistId)
      .eq("user_id", userId);
    if (error)
      fail(
        error.message.includes("duplicate")
          ? `You already have a watchlist named "${data.name}".`
          : `Could not rename the watchlist: ${error.message}`,
      );
    return { ok: true };
  });

export const addWatchlistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        watchlistId: z.string().uuid(),
        symbol: z.string().trim().min(1).max(20),
        priority: z.enum(["normal", "high"]).default("normal"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const symbol = data.symbol.toUpperCase();
    if (!isSupportedSymbol(symbol)) fail(`${symbol} is not a supported symbol.`);

    const { data: owned } = await supabase
      .from("watchlists")
      .select("id")
      .eq("id", data.watchlistId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!owned) fail("Watchlist not found.");

    const { error } = await supabase
      .from("watchlist_items")
      .insert({ watchlist_id: data.watchlistId, symbol, priority: data.priority });
    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate"))
        fail(`${symbol} is already in this watchlist.`);
      fail(`Could not add ${symbol}: ${error.message}`);
    }
    return { symbol };
  });

export const removeWatchlistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ itemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("watchlist_items").delete().eq("id", data.itemId);
    if (error) fail(`Could not remove the stock: ${error.message}`);
    return { ok: true };
  });

export const setItemPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ itemId: z.string().uuid(), priority: z.enum(["normal", "high"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("watchlist_items")
      .update({ priority: data.priority })
      .eq("id", data.itemId);
    if (error) fail(`Could not update priority: ${error.message}`);
    return { ok: true };
  });

// --------------------------------------------------------------- settings ---

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profile = await loadProfile(supabase, userId);
    const watchlists = await resolveWatchlist(supabase, userId);
    return { profile, watchlists };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        attentionSensitivity: z.enum(["conservative", "balanced", "sensitive"]).optional(),
        defaultWatchlistId: z.string().uuid().nullable().optional(),
        displayName: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.defaultWatchlistId) {
      const { data: ownedWatchlist, error: watchlistError } = await supabase
        .from("watchlists")
        .select("id")
        .eq("id", data.defaultWatchlistId)
        .eq("user_id", userId)
        .maybeSingle();
      if (watchlistError) fail(`Could not verify your default watchlist: ${watchlistError.message}`);
      if (!ownedWatchlist) fail("That watchlist does not belong to your account.");
    }
    const patch: Record<string, unknown> = {};
    if (data.attentionSensitivity) patch.attention_sensitivity = data.attentionSensitivity;
    if (data.defaultWatchlistId !== undefined) patch.default_watchlist_id = data.defaultWatchlistId;
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) fail(`Could not save your settings: ${error.message}`);
    return { ok: true };
  });
