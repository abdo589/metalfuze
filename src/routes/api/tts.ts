import { createFileRoute } from "@tanstack/react-router";

// ElevenLabs voice for the advisor — only the accounts listed in VOICE_EMAILS may use it.
const VOICE_EMAILS = ["eilaf@metalfuze.local", "abdelrhman@metalfuze.local", "aisha@metalfuze.local"];
const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["ELEVENLABS_API_KEY"];
        if (!key) return new Response("not configured", { status: 500 });
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: auth } = await supabaseAdmin.auth.getUser(token);
        const email = auth.user?.email?.toLowerCase();
        if (!email || !VOICE_EMAILS.includes(email)) return new Response("forbidden", { status: 403 });
        let text = "";
        try { const b = await request.json(); text = typeof b.text === "string" ? b.text : ""; }
        catch { return new Response("bad request", { status: 400 }); }
        text = text.replace(/[*#`_>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 2500);
        if (!text) return new Response("empty", { status: 400 });
        const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
        });
        if (!r.ok) {
          const err = await r.text();
          console.error(`[tts] ${r.status}: ${err}`);
          return new Response(`ElevenLabs ${r.status}: ${err.slice(0, 300)}`, { status: 502 });
        }
        return new Response(r.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
      },
    },
  },
});
