import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, RefreshCw, TriangleAlert } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { getStockDetail } from "@/lib/nexora.functions";

type StockDetail = Awaited<ReturnType<typeof getStockDetail>>;
type AttentionReason = StockDetail["attention"]["reasons"][number];
type SignalKey = AttentionReason["signal"];

const SIGNALS: { key: SignalKey; label: string }[] = [
  { key: "PRICE_ANOMALY", label: "Price anomaly" },
  { key: "VOLUME_ANOMALY", label: "Volume anomaly" },
  { key: "RELATIVE_PERFORMANCE", label: "Relative performance" },
  { key: "VOLATILITY_CHANGE", label: "Volatility change" },
  { key: "EVENT_IMPORTANCE", label: "Event importance" },
];

export function StockDetails({ symbol }: { symbol: string }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const next = await getStockDetail({ data: { symbol } });
      setDetail(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this stock.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!checking) void loadDetail();
  }, [checking, symbol]);

  async function handleSignOut() {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    window.location.assign("/auth");
  }

  if (checking || (loading && !detail)) return <Message text="Loading stock details..." />;
  if (error && !detail) {
    return (
      <Message text={error} action={<Button onClick={() => void loadDetail()}>Try again</Button>} />
    );
  }
  if (!detail) return null;

  const { instrument, observation, previous, attention, event, history } = detail;
  const reasonsBySignal = new Map(attention.reasons.map((reason) => [reason.signal, reason]));
  const freshnessLabel = capitalize(observation.freshness);

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
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleSignOut()}>
            <LogOut /> Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Dashboard
        </Link>

        <section className="flex flex-col justify-between gap-6 border-b pb-8 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {instrument.sector}
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">{instrument.symbol}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{instrument.companyName}</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-3xl font-semibold">
              INR {observation.price.toLocaleString("en-IN")}
            </p>
            <p
              className={
                observation.changePercent < 0 ? "mt-1 text-destructive" : "mt-1 text-emerald-700"
              }
            >
              {observation.changePercent > 0 ? "+" : ""}
              {observation.changePercent.toFixed(2)}%
            </p>
            <div className="mt-3 flex flex-wrap gap-2 md:justify-end">
              <Badge variant={observation.freshness === "stale" ? "destructive" : "outline"}>
                {freshnessLabel} data
              </Badge>
              <Badge variant="secondary">{observation.source}</Badge>
              <Badge variant="outline">
                {detail.inWatchlist
                  ? `${capitalize(detail.priority)} priority`
                  : "Not in this watchlist"}
              </Badge>
            </div>
          </div>
        </section>

        {observation.freshness === "stale" && (
          <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <TriangleAlert className="size-4" />
            This market data may be outdated.
          </div>
        )}
        {observation.freshness === "delayed" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This observation is delayed. Last observed {formatDate(observation.observedAt)}.
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-[1.35fr_1fr_1fr]">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">Attention score</p>
              <p className="mt-2 text-5xl font-semibold text-primary">
                {attention.attentionScore}
                <span className="text-2xl text-muted-foreground"> / 100</span>
              </p>
              <Badge
                className="mt-4"
                variant={attention.level === "HIGH" ? "destructive" : "secondary"}
              >
                {attention.level} attention
              </Badge>
              <p className="mt-4 text-sm leading-6">{attention.summary}</p>
            </CardContent>
          </Card>
          <MetricCard
            label="Market significance"
            value={`${attention.marketSignificance} / 100`}
            detail="Objective market signals"
          />
          <MetricCard
            label="Personal relevance"
            value={`${attention.personalRelevance} / 100`}
            detail={
              detail.priority === "high"
                ? "High-priority watchlist item"
                : "Normal watchlist priority"
            }
          />
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Why this matters</CardTitle>
              <p className="text-sm text-muted-foreground">
                Signals returned by Nexora&apos;s attention engine.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {attention.reasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No unusual signals were detected.</p>
              ) : (
                attention.reasons.map((reason) => <ReasonRow key={reason.signal} reason={reason} />)
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Signal breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {SIGNALS.map((signal) => {
                const reason = reasonsBySignal.get(signal.key);
                return (
                  <div key={signal.key}>
                    <div className="flex justify-between gap-4 text-sm">
                      <span className={reason ? "font-medium" : "text-muted-foreground"}>
                        {signal.label}
                      </span>
                      <span className="font-medium">
                        {reason ? `${reason.contribution} pts` : "Not detected"}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(reason?.contribution ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        {event && (
          <Card>
            <CardHeader>
              <CardTitle>{event.title}</CardTitle>
              <p className="text-sm text-muted-foreground">Market event</p>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Type" value={event.eventType} />
              <Info label="Importance" value={event.importance} />
              <Info label="Event time" value={formatDate(event.eventTime)} />
              <div className="sm:col-span-2 lg:col-span-1">
                <p className="text-muted-foreground">Description</p>
                <p className="mt-1">{event.description ?? "No description provided."}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent history</CardTitle>
            <p className="text-sm text-muted-foreground">
              Latest market observations. The comparison is the latest market movement, not
              necessarily movement since your last visit.
            </p>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history is available.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Observed</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={`${row.observedAt}-${row.source}`}>
                      <TableCell>{formatDate(row.observedAt)}</TableCell>
                      <TableCell>INR {row.price.toLocaleString("en-IN")}</TableCell>
                      <TableCell
                        className={row.changePercent < 0 ? "text-destructive" : "text-emerald-700"}
                      >
                        {row.changePercent > 0 ? "+" : ""}
                        {row.changePercent.toFixed(2)}%
                      </TableCell>
                      <TableCell>{row.volume.toLocaleString("en-IN")}</TableCell>
                      <TableCell>{row.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Observed {formatDate(observation.observedAt)} · Server time {formatDate(detail.serverNow)}
          {previous
            ? " · Compared with the previous recorded observation"
            : " · No previous observation available"}
        </p>
      </div>
    </main>
  );
}

function ReasonRow({ reason }: { reason: AttentionReason }) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{reason.label}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {reason.signal}
          </p>
        </div>
        <Badge variant="outline">{reason.contribution} pts</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span>{reason.value}</span>
        <span className="text-muted-foreground">Strength {reason.strength.toFixed(2)}</span>
      </div>
    </div>
  );
}
function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="py-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-3 text-2xl font-semibold">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium capitalize">{value}</p>
    </div>
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
function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
