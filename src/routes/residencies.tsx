import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/residencies")({
  beforeLoad: () => { throw redirect({ to: "/hr-file" }); },
});
