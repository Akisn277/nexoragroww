import { createFileRoute } from "@tanstack/react-router";

import { Settings } from "@/components/nexora/settings";

export const Route = createFileRoute("/settings")({ component: Settings });
