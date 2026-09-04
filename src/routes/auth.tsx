import { createFileRoute } from "@tanstack/react-router";

import { AuthForm } from "@/components/nexora/auth-form";

export const Route = createFileRoute("/auth")({
  component: AuthForm,
});