import { createFileRoute } from "@tanstack/react-router";

import { StockDetails } from "@/components/nexora/stock-details";

export const Route = createFileRoute("/stocks/$symbol")({
  component: StockRoute,
});

function StockRoute() {
  const { symbol } = Route.useParams();
  return <StockDetails symbol={symbol} />;
}
