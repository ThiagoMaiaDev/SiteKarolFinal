import { createFileRoute } from "@tanstack/react-router";
import { BookingPage } from "@/components/BookingPage";

export const Route = createFileRoute("/")({
  component: BookingPage,
});
