import { createFileRoute } from "@tanstack/react-router";

// ZKTeco ADMS (push) endpoint. Path is fixed by the device firmware: /iclock/cdata.
// Handshake only: unsigned pushes are acknowledged but never stored (see POST).
const text = (s: string, status = 200) => new Response(s, { status, headers: { "Content-Type": "text/plain" } });

// Devices are added manually by an admin; unknown serials are ignored (never inserted).
// Requests must also come from an allowed office IP (ATTENDANCE_ALLOWED_IPS, comma-separated).
function ipAllowed(request: Request): boolean {
  const allowed = (process.env["ATTENDANCE_ALLOWED_IPS"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  // Only the edge-set client IP is trusted; client-sendable headers like x-real-ip are ignored.
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  return allowed.length > 0 && !!ip && allowed.includes(ip);
}

async function device(sn: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("attendance_devices").select("approved").eq("serial_number", sn).maybeSingle();
  return { admin: supabaseAdmin, known: !!data, approved: !!data?.approved };
}

export const Route = createFileRoute("/iclock/cdata")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sn = new URL(request.url).searchParams.get("SN")?.slice(0, 64);
        if (!sn) return text("Missing SN", 400);
        if (!ipAllowed(request)) return text("Forbidden", 403);
        const { known } = await device(sn);
        if (!known) return text("Unknown device", 403);
        return text([`GET OPTION FROM: ${sn}`, "ATTLOGStamp=None", "OPERLOGStamp=9999", "ATTPHOTOStamp=None",
          "ErrorDelay=30", "Delay=10", "TransTimes=00:00;14:05", "TransInterval=1", "TransFlag=TransData AttLog",
          "TimeZone=3", "Realtime=1", "Encrypt=None"].join("\n"));
      },
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const sn = url.searchParams.get("SN")?.slice(0, 64);
        if (!sn) return text("Missing SN", 400);
        if (!ipAllowed(request)) return text("Forbidden", 403);
        const { approved } = await device(sn);
        if (url.searchParams.get("table") !== "ATTLOG") return text("OK");
        if (!approved) return text("OK: 0"); // pending approval in the attendance page
        // The ADMS protocol carries no secret, so anyone who knows the serial could forge punches.
        // Unsigned pushes are never stored; punches arrive via the token-signed office agent
        // (/api/public/attendance-agent). The device still gets "OK" so it keeps its connection.
        return text("OK: 0");
      },
    },
  },
});
