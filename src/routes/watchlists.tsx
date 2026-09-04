import { createFileRoute } from "@tanstack/react-router";

import { Watchlists } from "@/components/nexora/watchlists";

export const Route = createFileRoute("/watchlists")({
  component: Watchlists,
});
