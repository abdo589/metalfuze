import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type OAuthResult = { data: { redirect_url?: string; redirect_to?: string; client?: { name?: string } } | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s['authorization_id'] === "string" ? s['authorization_id'] : "",
  }),
  head: () => ({
    meta: [
      { title: "Authorize app — Metalfuze" },
      { name: "description", content: "Approve or deny an assistant's access to your Metalfuze account." },
      { property: "og:title", content: "Authorize app — Metalfuze" },
      { property: "og:description", content: "Approve or deny an assistant's access to your Metalfuze account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Consent,
});

function Consent() {
  const { authorization_id } = Route.useSearch();
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorization_id) { setError("Missing authorization_id"); setLoading(false); return; }
    oauth().getAuthorizationDetails(authorization_id).then(({ data, error }) => {
      if (error) { setError(error.message); setLoading(false); return; }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) { window.location.href = immediate; return; }
      setName(data?.client?.name ?? "an app");
      setLoading(false);
    }).catch((e) => { setError(String(e)); setLoading(false); });
  }, [authorization_id]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = approve
        ? await oauth().approveAuthorization(authorization_id)
        : await oauth().denyAuthorization(authorization_id);
      if (error) throw new Error(error.message);
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) throw new Error("No redirect returned by the authorization server.");
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Connect {name ?? "an app"} to your Metalfuze account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This lets {name ?? "the app"} read Metalfuze data as you, limited to what your account can already see.
          </p>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          {name && (
            <div className="mt-6 flex gap-3">
              <Button disabled={busy} onClick={() => decide(true)}>Approve</Button>
              <Button variant="outline" disabled={busy} onClick={() => decide(false)}>Deny</Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
