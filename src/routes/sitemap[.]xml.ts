import { createFileRoute } from "@tanstack/react-router";

// The app is private behind sign-in; only the public home/sign-in page is listed.
const BASE_URL = "https://www.metalfuze.com";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${BASE_URL}/</loc></url></urlset>`,
          { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } },
        ),
    },
  },
});
