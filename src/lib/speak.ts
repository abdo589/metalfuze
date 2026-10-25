/**
 * Voice announcements for payroll (browser speech synthesis — no server cost).
 * The on/off preference is read lazily inside event handlers only, never during
 * render, so SSR never touches localStorage.
 */
const VOICE_KEY = "payroll-voice";

export function payrollVoiceOn(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(VOICE_KEY) !== "off"; } catch { return true; }
}

export function setPayrollVoice(on: boolean): void {
  try { localStorage.setItem(VOICE_KEY, on ? "on" : "off"); } catch { /* ignore */ }
}

/** Speaks one short sentence aloud; best-effort, silently ignored if unsupported. */
export function speakPayroll(text: string, locale = "ar"): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!payrollVoiceOn() || !text) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale.toLowerCase().startsWith("en") ? "en-US" : "ar-SA";
    u.rate = 1;
    const v = synth.getVoices().find((x) => x.lang?.toLowerCase().startsWith(u.lang.slice(0, 2)));
    if (v) u.voice = v;
    synth.speak(u);
  } catch { /* speech is best-effort */ }
}
