import { useEffect, useRef, useState } from "react";
import { Loader2, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export const VOICE_EMAILS = ["eilaf@metalfuze.local", "abdelrhman@metalfuze.local", "aisha@metalfuze.local"];

export function useVoiceAllowed() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setOk(VOICE_EMAILS.includes(data.user?.email?.toLowerCase() ?? "")));
  }, []);
  return ok;
}

/** Reads an advisor reply aloud with the ElevenLabs voice. */
export function SpeakButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audio.current?.pause(); }, []);

  const stop = () => { audio.current?.pause(); audio.current = null; setState("idle"); };
  const play = async () => {
    if (state !== "idle") return stop();
    setState("loading");
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error(await r.text());
      const url = URL.createObjectURL(await r.blob());
      const a = new Audio(url);
      audio.current = a;
      a.onended = () => { URL.revokeObjectURL(url); setState("idle"); };
      await a.play();
      setState("playing");
    } catch (e) {
      setState("idle");
      toast.error(t("تعذر تشغيل الصوت"), { description: e instanceof Error ? e.message.slice(0, 200) : undefined });
    }
  };

  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={play}
      aria-label={state === "playing" ? t("إيقاف") : t("استمع")}>
      {state === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : state === "playing" ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />}
      {state === "playing" ? t("إيقاف") : t("استمع")}
    </Button>
  );
}
