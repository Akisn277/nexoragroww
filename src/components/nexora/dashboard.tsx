import { useEffect, useRef, useState } from "react";
import { LogOut, RefreshCw, TriangleAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboard, markDashboardSeen, simulateMarketUpdate } from "@/lib/nexora.functions";
import { supabase } from "@/integrations/supabase/client";

type DashboardResponse = Awaited<ReturnType<typeof getDashboard>>;
type DashboardModel = NonNullable<DashboardResponse["dashboard"]>;
type ChangeItem = DashboardModel["meaningful"][number];
type UnchangedItem = DashboardModel["unchanged"][number];

export function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [seenReady, setSeenReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const seenRef = useRef(false);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const next = await getDashboard({ data: { refreshToken: Date.now() } });
      setData(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      setEmail(sessionData.session?.user.email ?? null);
    });
  }, []);

  useEffect(() => {
    if (!data || seenRef.current) return;
    seenRef.current = true;
    void markDashboardSeen()
      .then(() => setSeenReady(true))
      .catch((cause: unknown) => {
        setFeedback(
          cause instanceof Error ? cause.message : "Could not mark the dashboard as seen.",
        );
      });
  }, [data]);

  async function handleSignOut() {
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    window.location.assign("/auth");
  }

  async function handleSimulation() {
    setSimulating(true);
    setFeedback(null);
    try {
      const result = await simulateMarketUpdate();
      setFeedback(`Market update ${result.step} complete. ${result.updated} symbols refreshed.`);
      await loadDashboard();
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : "The market update failed.");
    } finally {
      setSimulating(false);
    }
  }

  if (loading && !data) return <PageMessage label="Loading your market brief" />;
  if (error && !data)
    return (
      <PageMessage
        label={error}
        action={<Button onClick={() => void loadDashboard()}>Try again</Button>}
      />
    );
  if (!data) return null;

  const dashboard = data.dashboard;
  const meaningful = dashboard?.meaningful ?? [];
  const unchanged = dashboard?.unchanged ?? [];
  const staleCount = dashboard?.staleCount ?? 0;
  const missingSymbols = dashboard?.missingSymbols ?? [];
  const accountLabel = email ?? data.profile.display_name ?? "Your account";

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-lg font-bold tracking-tight text-foreground">Nexora</p>
            <p className="text-xs text-muted-foreground">Know what changed. Know why it matters.</p>
          </div>
          <div className="flex items-center gap-4">
            <nav
              aria-label="Primary navigation"
              className="hidden items-center gap-1 text-sm sm:flex"
            >
              <Link to="/" className="rounded-md bg-muted px-3 py-2 font-medium text-foreground">
                Dashboard
              </Link>
              <Link
                to="/watchlists"
                className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
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
            <span className="hidden text-sm text-muted-foreground sm:inline">{accountLabel}</span>
            <Button variant="outline" size="sm" onClick={() => void handleSignOut()}>
              <LogOut /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Demo market data
              </span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">What changed</h1>
            <p className="mt-2 text-muted-foreground">
              {data.lastVisitAt
                ? `Since your last visit at ${formatDate(data.lastVisitAt)}`
                : "Your latest watchlist brief"}
            </p>
          </div>
          <Button onClick={() => void handleSimulation()} disabled={simulating || !seenReady}>
            <RefreshCw className={simulating ? "animate-spin" : ""} />{" "}
            {simulating ? "Updating..." : "Simulate Market Update"}
          </Button>
        </section>

        {feedback && (
          <p
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {feedback}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {staleCount > 0 && (
          <Warning
            text={`${staleCount} stock${staleCount === 1 ? " has" : "s have"} stale market data. Timestamps are shown below.`}
          />
        )}
        {missingSymbols.length > 0 && (
          <Warning text={`Market data is unavailable for ${missingSymbols.join(", ")}.`} />
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Meaningful changes" value={meaningful.length} accent="text-primary" />
          <Summary label="Unchanged" value={dashboard?.unchangedCount ?? 0} />
          <Summary
            label="Stale"
            value={staleCount}
            {...(staleCount ? { accent: "text-amber-700" } : {})}
          />
          <Summary label="Watchlist size" value={data.itemCount} />
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Meaningful changes</h2>
            <p className="text-sm text-muted-foreground">Ranked by explainable attention score.</p>
          </div>
          {meaningful.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nothing meaningful changed since your last visit.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {meaningful.map((item) => (
                <ChangeCard key={item.snapshotId} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Unchanged</h2>
            <p className="text-sm text-muted-foreground">
              Stocks without a surfaced attention signal.
            </p>
          </div>
          {unchanged.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unchanged stocks in this watchlist.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {unchanged.map((item) => (
                <UnchangedCard key={item.symbol} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ChangeCard({ item }: { item: ChangeItem }) {
  const high = item.attention.level === "HIGH";
  return (
    <Link to="/stocks/$symbol" params={{ symbol: item.symbol }} className="block">
      <Card className={high ? "border-l-4 border-l-destructive" : ""}>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{item.symbol}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{item.companyName}</p>
          </div>
          <Badge variant={high ? "destructive" : "secondary"}>
            {item.attention.level} attention
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-semibold">INR {item.price.toLocaleString("en-IN")}</p>
              <p
                className={
                  item.changePercent < 0 ? "text-sm text-destructive" : "text-sm text-emerald-700"
                }
              >
                {item.changePercent > 0 ? "+" : ""}
                {item.changePercent.toFixed(2)}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-primary">{item.attention.attentionScore}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Attention / 100
              </p>
            </div>
          </div>
          <p className="text-sm leading-6 text-foreground">{item.attention.summary}</p>
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Why this is flagged
            </p>
            {item.attention.reasons.map((reason) => (
              <div key={reason.signal} className="flex justify-between gap-4 text-sm">
                <span>{reason.label}</span>
                <span className="text-right font-medium">{reason.value}</span>
              </div>
            ))}
            {item.event && (
              <div className="mt-3 rounded-md bg-muted/60 p-3 text-sm">
                <p className="font-medium">{item.event.title}</p>
                {item.event.description && (
                  <p className="mt-1 text-muted-foreground">{item.event.description}</p>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {item.freshness === "stale"
              ? "Stale"
              : item.freshness === "delayed"
                ? "Delayed"
                : "Fresh"}{" "}
            data · {formatDate(item.observedAt)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function UnchangedCard({ item }: { item: UnchangedItem }) {
  return (
    <Link to="/stocks/$symbol" params={{ symbol: item.symbol }} className="block">
      <Card className="shadow-none">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="font-medium">{item.symbol}</p>
            <p className="text-xs text-muted-foreground">{item.companyName}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">INR {item.price.toLocaleString("en-IN")}</p>
            <p
              className={
                item.changePercent < 0 ? "text-xs text-destructive" : "text-xs text-emerald-700"
              }
            >
              {item.changePercent > 0 ? "+" : ""}
              {item.changePercent.toFixed(2)}%
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Summary({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-2 text-3xl font-semibold ${accent ?? "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
function Warning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      {text}
    </div>
  );
}
function PageMessage({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-6">
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">{label}</p>
        {action}
      </div>
    </main>
  );
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
