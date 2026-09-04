import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { searchInstruments } from "@/lib/market/instruments";
import {
  addWatchlistItem,
  createWatchlist,
  getWatchlistView,
  removeWatchlistItem,
  renameWatchlist,
  setItemPriority,
} from "@/lib/nexora.functions";

type WatchlistView = Awaited<ReturnType<typeof getWatchlistView>>;
type Watchlist = { id: string; name: string; created_at: string };
type WatchlistItem = {
  id: string;
  symbol: string;
  priority: "normal" | "high";
  addedAt: string;
  companyName: string;
  sector: string;
  quote: {
    price: number;
    changePercent: number;
  } | null;
};
type TypedWatchlistView = Omit<WatchlistView, "watchlists" | "items"> & {
  watchlists: Watchlist[];
  items: WatchlistItem[];
};

export function Watchlists() {
  const navigate = useNavigate();
  const [view, setView] = useState<TypedWatchlistView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [search, setSearch] = useState("");
  const [addPriority, setAddPriority] = useState<"normal" | "high">("normal");

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        void navigate({ to: "/auth", replace: true });
        return;
      }
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function loadView(watchlistId?: string) {
    setLoading(true);
    setError(null);
    try {
      const next = await getWatchlistView({
        data: watchlistId ? { watchlistId } : {},
      });
      setView(next as TypedWatchlistView);
      setSelectedId(next.activeWatchlistId);
      const active = (next.watchlists as Watchlist[]).find(
        (watchlist) => watchlist.id === next.activeWatchlistId,
      );
      setRenameName(active?.name ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your watchlists.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!checking) void loadView();
  }, [checking]);

  const activeWatchlist =
    view?.watchlists.find((watchlist: Watchlist) => watchlist.id === selectedId) ?? null;
  const existingSymbols = useMemo(
    () => new Set((view?.items ?? []).map((item) => item.symbol)),
    [view?.items],
  );
  const results = searchInstruments(search);

  async function refresh(message?: string, watchlistId = selectedId ?? undefined) {
    setFeedback(message ?? null);
    await loadView(watchlistId);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (name.length < 1 || name.length > 60) {
      setError("Watchlist names must be between 1 and 60 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createWatchlist({ data: { name } });
      setNewName("");
      setShowCreate(false);
      await refresh(`Created “${created.name}”.`, created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the watchlist.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const name = renameName.trim();
    if (name.length < 1 || name.length > 60) {
      setError("Watchlist names must be between 1 and 60 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await renameWatchlist({ data: { watchlistId: selectedId, name } });
      setEditingName(false);
      await refresh("Watchlist renamed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not rename the watchlist.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(symbol: string) {
    if (!selectedId || existingSymbols.has(symbol)) return;
    setBusy(true);
    setError(null);
    try {
      await addWatchlistItem({ data: { watchlistId: selectedId, symbol, priority: addPriority } });
      setSearch("");
      await refresh(`${symbol} added to ${activeWatchlist?.name ?? "your watchlist"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the stock.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(item: WatchlistItem) {
    if (!window.confirm(`Remove ${item.symbol} from ${activeWatchlist?.name ?? "this watchlist"}?`))
      return;
    setBusy(true);
    setError(null);
    try {
      await removeWatchlistItem({ data: { itemId: item.id } });
      await refresh(`${item.symbol} removed.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove the stock.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePriority(item: WatchlistItem, priority: "normal" | "high") {
    if (priority === item.priority) return;
    setBusy(true);
    setError(null);
    try {
      await setItemPriority({ data: { itemId: item.id, priority } });
      await refresh(`${item.symbol} priority updated.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update priority.");
    } finally {
      setBusy(false);
    }
  }

  if (checking || (loading && !view)) return <Message text="Loading your watchlists..." />;
  if (error && !view)
    return (
      <Message text={error} action={<Button onClick={() => void loadView()}>Try again</Button>} />
    );
  if (!view) return null;

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold tracking-tight text-foreground">
              Nexora
            </Link>
            <nav aria-label="Primary navigation" className="flex items-center gap-1 text-sm">
              <Link
                to="/"
                className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                to="/watchlists"
                className="rounded-md bg-muted px-3 py-2 font-medium text-foreground"
              >
                Watchlists
              </Link>
              <Link
                to="/settings"
                className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Settings
              </Link>
            </nav>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void supabase.auth.signOut().then(() => {
                window.location.assign("/auth");
              });
            }}
          >
            <ArrowLeft /> Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Your market lists
            </p>
            <h1 className="text-4xl font-semibold tracking-tight">Watchlists</h1>
            <p className="mt-2 text-muted-foreground">
              Keep the stocks that matter to you in view.
            </p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus /> New watchlist
          </Button>
        </section>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {feedback && (
          <p
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {feedback}
          </p>
        )}

        {showCreate && (
          <Card>
            <CardContent className="pt-6">
              <form
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={handleCreate}
              >
                <div className="flex-1 space-y-2">
                  <Label htmlFor="new-watchlist">Watchlist name</Label>
                  <Input
                    id="new-watchlist"
                    maxLength={60}
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="e.g. Long-term focus"
                    autoFocus
                  />
                </div>
                <Button type="submit" disabled={busy}>
                  Create
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {view.watchlists.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-medium">No watchlists yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first list to start tracking stocks.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <Label htmlFor="watchlist-select">Active watchlist</Label>
                <Select
                  {...(selectedId ? { value: selectedId } : {})}
                  onValueChange={(id) => {
                    setSelectedId(id);
                    void loadView(id);
                  }}
                >
                  <SelectTrigger id="watchlist-select" className="mt-2 max-w-md">
                    <SelectValue placeholder="Select a watchlist" />
                  </SelectTrigger>
                  <SelectContent>
                    {view.watchlists.map((watchlist: Watchlist) => (
                      <SelectItem key={watchlist.id} value={watchlist.id}>
                        {watchlist.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeWatchlist &&
                (editingName ? (
                  <form className="flex items-end gap-2" onSubmit={handleRename}>
                    <div className="space-y-2">
                      <Label htmlFor="rename-watchlist">Rename</Label>
                      <Input
                        id="rename-watchlist"
                        maxLength={60}
                        value={renameName}
                        onChange={(event) => setRenameName(event.target.value)}
                      />
                    </div>
                    <Button type="submit" disabled={busy}>
                      Save
                    </Button>
                  </form>
                ) : (
                  <Button variant="outline" onClick={() => setEditingName(true)}>
                    <Pencil /> Rename
                  </Button>
                ))}
            </section>

            <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {activeWatchlist?.name ?? "Watchlist"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {view.items.length} {view.items.length === 1 ? "stock" : "stocks"}
                    </p>
                  </div>
                </div>
                {view.items.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      This watchlist is empty. Search for a stock to add it.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {view.items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        busy={busy}
                        onRemove={() => void handleRemove(item)}
                        onPriority={(priority) => void handlePriority(item, priority)}
                      />
                    ))}
                  </div>
                )}
              </div>
              <AddStockPanel
                search={search}
                setSearch={setSearch}
                results={results}
                existingSymbols={existingSymbols}
                priority={addPriority}
                setPriority={setAddPriority}
                busy={busy || !selectedId}
                onAdd={(symbol) => void handleAdd(symbol)}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function AddStockPanel({
  search,
  setSearch,
  results,
  existingSymbols,
  priority,
  setPriority,
  busy,
  onAdd,
}: {
  search: string;
  setSearch: (value: string) => void;
  results: ReturnType<typeof searchInstruments>;
  existingSymbols: Set<string>;
  priority: "normal" | "high";
  setPriority: (value: "normal" | "high") => void;
  busy: boolean;
  onAdd: (symbol: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add stock</CardTitle>
        <p className="text-sm text-muted-foreground">Search by symbol or company name.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Search instruments"
            aria-label="Search instruments"
          />
        </div>
        <div className="space-y-2">
          <Label>Priority for new stock</Label>
          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as "normal" | "high")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs leading-5 text-muted-foreground">
            High-priority stocks receive more personal relevance in Nexora&apos;s attention score.
          </p>
        </div>
        {search.trim() && (
          <div className="max-h-72 space-y-2 overflow-y-auto border-t pt-3">
            {results.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No instruments found.</p>
            ) : (
              results.map((instrument) => {
                const added = existingSymbols.has(instrument.symbol);
                return (
                  <div
                    key={instrument.symbol}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium">{instrument.symbol}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {instrument.companyName} · {instrument.sector}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={added ? "secondary" : "outline"}
                      disabled={added || busy}
                      onClick={() => onAdd(instrument.symbol)}
                    >
                      {added ? "Added" : "Add"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ItemCard({
  item,
  busy,
  onRemove,
  onPriority,
}: {
  item: WatchlistItem;
  busy: boolean;
  onRemove: () => void;
  onPriority: (priority: "normal" | "high") => void;
}) {
  const quote = item.quote;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/stocks/$symbol"
          params={{ symbol: item.symbol }}
          className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-2">
            <p className="font-semibold">{item.symbol}</p>
            {item.priority === "high" && (
              <Badge variant="outline">
                <Star className="mr-1 size-3 fill-current" /> High
              </Badge>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {item.companyName} · {item.sector}
          </p>
        </Link>
        <div className="flex flex-wrap items-center gap-4 sm:justify-end">
          {quote ? (
            <div className="text-right">
              <p className="font-medium">INR {quote.price.toLocaleString("en-IN")}</p>
              <p
                className={
                  quote.changePercent < 0 ? "text-sm text-destructive" : "text-sm text-emerald-700"
                }
              >
                {quote.changePercent > 0 ? "+" : ""}
                {quote.changePercent.toFixed(2)}%
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-700">No market data</p>
          )}
          <Select
            value={item.priority}
            onValueChange={(value) => onPriority(value as "normal" | "high")}
            disabled={busy}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${item.symbol}`}
            title={`Remove ${item.symbol}`}
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Message({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-6">
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">{text}</p>
        {action}
      </div>
    </main>
  );
}
