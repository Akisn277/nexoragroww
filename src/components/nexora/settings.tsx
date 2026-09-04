import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";

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
import { getSettings, updateSettings } from "@/lib/nexora.functions";

type SettingsResponse = Awaited<ReturnType<typeof getSettings>>;
type SettingsProfile = {
  attention_sensitivity: "conservative" | "balanced" | "sensitive";
  default_watchlist_id: string | null;
  display_name: string | null;
};
type SettingsWatchlist = { id: string; name: string; created_at: string };
type TypedSettings = Omit<SettingsResponse, "profile" | "watchlists"> & {
  profile: SettingsProfile;
  watchlists: SettingsWatchlist[];
};

const sensitivityOptions = [
  { value: "conservative", label: "Conservative", detail: "Only major changes" },
  { value: "balanced", label: "Balanced", detail: "Meaningful changes" },
  { value: "sensitive", label: "Sensitive", detail: "Surface smaller changes" },
] as const;

export function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<TypedSettings | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [sensitivity, setSensitivity] =
    useState<SettingsProfile["attention_sensitivity"]>("balanced");
  const [defaultWatchlistId, setDefaultWatchlistId] = useState<string>("none");
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

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

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const next = (await getSettings()) as TypedSettings;
      setSettings(next);
      setDisplayName(next.profile.display_name ?? "");
      setSensitivity(next.profile.attention_sensitivity);
      setDefaultWatchlistId(next.profile.default_watchlist_id ?? "none");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!checking) void loadSettings();
  }, [checking]);

  async function save(
    data: Parameters<typeof updateSettings>[0]["data"],
    key: string,
    message: string,
  ) {
    setSaving(key);
    setError(null);
    setFeedback(null);
    try {
      await updateSettings({ data });
      setFeedback(message);
      await loadSettings();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save settings.");
    } finally {
      setSaving(null);
    }
  }

  async function handleSignOut() {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else window.location.assign("/auth");
  }

  if (checking || (loading && !settings))
    return <SettingsMessage text="Loading your settings..." />;
  if (error && !settings)
    return (
      <SettingsMessage
        text={error}
        action={<Button onClick={() => void loadSettings()}>Try again</Button>}
      />
    );
  if (!settings) return null;

  const selectedWatchlist = settings.watchlists.find(
    (watchlist) => watchlist.id === defaultWatchlistId,
  );

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold tracking-tight text-foreground">
              Nexora
            </Link>
            <nav aria-label="Primary navigation" className="flex items-center gap-1 text-sm">
              <NavLink to="/">Dashboard</NavLink>
              <NavLink to="/watchlists">Watchlists</NavLink>
              <NavLink to="/settings" active>
                Settings
              </NavLink>
            </nav>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleSignOut()}>
            <LogOut /> Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Personal preferences
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Customize how Nexora decides what deserves your attention.
          </p>
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

        <Card>
          <CardHeader>
            <CardTitle>Attention sensitivity</CardTitle>
            <p className="text-sm text-muted-foreground">
              This controls which Attention Scores are surfaced as meaningful changes. It does not
              change the underlying score.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              {sensitivityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSensitivity(option.value)}
                  className={`rounded-lg border p-4 text-left transition-colors ${sensitivity === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{option.detail}</span>
                </button>
              ))}
            </div>
            <Button
              disabled={saving !== null || sensitivity === settings.profile.attention_sensitivity}
              onClick={() =>
                void save(
                  { attentionSensitivity: sensitivity },
                  "sensitivity",
                  "Attention sensitivity saved.",
                )
              }
            >
              {saving === "sensitivity" ? "Saving..." : "Save sensitivity"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default watchlist</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose which list opens on your dashboard.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={defaultWatchlistId} onValueChange={setDefaultWatchlistId}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select a watchlist" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No default watchlist</SelectItem>
                {settings.watchlists.map((watchlist) => (
                  <SelectItem key={watchlist.id} value={watchlist.id}>
                    {watchlist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {selectedWatchlist
                ? `Currently selected: ${selectedWatchlist.name}`
                : "The dashboard will use the first available watchlist."}
            </p>
            <Button
              disabled={
                saving !== null ||
                defaultWatchlistId === (settings.profile.default_watchlist_id ?? "none")
              }
              onClick={() =>
                void save(
                  { defaultWatchlistId: defaultWatchlistId === "none" ? null : defaultWatchlistId },
                  "watchlist",
                  "Default watchlist saved.",
                )
              }
            >
              {saving === "watchlist" ? "Saving..." : "Save default watchlist"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Display name</CardTitle>
            <p className="text-sm text-muted-foreground">
              This name is stored on your Nexora profile.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-md space-y-2">
              <Label htmlFor="display-name">Name</Label>
              <Input
                id="display-name"
                maxLength={80}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <Button
              disabled={
                saving !== null || displayName.trim() === (settings.profile.display_name ?? "")
              }
              onClick={() =>
                void save({ displayName: displayName.trim() }, "displayName", "Display name saved.")
              }
            >
              {saving === "displayName" ? "Saving..." : "Save display name"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function NavLink({
  to,
  children,
  active = false,
}: {
  to: "/" | "/watchlists" | "/settings";
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`rounded-md px-3 py-2 ${active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      {children}
    </Link>
  );
}
function SettingsMessage({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-6">
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">{text}</p>
        {action}
      </div>
    </main>
  );
}
