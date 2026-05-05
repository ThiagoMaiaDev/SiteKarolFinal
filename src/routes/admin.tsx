import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/AdminPage";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});
