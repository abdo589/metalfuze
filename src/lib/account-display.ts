export const SWITCH_OWNER = "eilaf@metalfuze.local";
/** Accounts allowed to keep several sessions on one device (Hisham is also the CEO). */
export const SWITCH_OWNERS = [SWITCH_OWNER, "hisham@metalfuze.local", "ceo@metalfuze.local"];
export const canSwitch = (email?: string | null) => !!email && SWITCH_OWNERS.includes(email);
type Identity = { id: string; email?: string | null | undefined; name: string };

export const EILAF_PINNED_ACCOUNTS = [
  { email: "haitham@metalfuze.local", name: "هيثم" },
  { email: "ceo@metalfuze.local", name: "CEO" },
];
export type SwitchAccount = { id: string; email: string; name: string; refresh: string };
export function isPinnedAccount(email: string, saved: SwitchAccount[]): boolean {
  return email === SWITCH_OWNER || (saved.some((a) => a.email === SWITCH_OWNER)
    && EILAF_PINNED_ACCOUNTS.some((a) => a.email === email));
}
export function switchAccounts(saved: SwitchAccount[]): SwitchAccount[] {
  if (!saved.some((a) => a.email === SWITCH_OWNER)) return saved;
  return [...saved, ...EILAF_PINNED_ACCOUNTS.filter((a) => !saved.some((s) => s.email === a.email))
    .map((a) => ({ ...a, id: a.email, refresh: "" }))];
}

/** Display only: never use saved identities to determine permissions. */
export function accountGreeting(active: Identity, saved: Identity[]): string {
  const owner = saved.find((x) => x.email === SWITCH_OWNER);
  return owner && saved.some((x) => x.id === active.id) ? owner.name : active.name;
}