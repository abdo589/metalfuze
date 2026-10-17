import { createFileRoute } from "@tanstack/react-router";

// ZKTeco devices poll this for commands; we have none to send.
export const Route = createFileRoute("/iclock/getrequest")({
  server: { handlers: { GET: async () => new Response("OK", { headers: { "Content-Type": "text/plain" } }) } },
});
