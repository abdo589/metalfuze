export const SWITCH_OWNER = "eilaf@metalfuze.local";
/** Accounts allowed to keep several sessions on one device (Hisham is also the CEO). */
export const SWITCH_OWNERS = [SWITCH_OWNER, "hisham@metalfuze.local", "ceo@metalfuze.local"];
export const canSwitch = (email?: string | null) => !!email && SWITCH_OWNERS.includes(email);
type Identity = { id: string; email?: string | null | undefined; name: string };

/** Display only: never use saved identities to determine permissions. */
export function accountGreeting(active: Identity, saved: Identity[]): string {
  const owner = saved.find((x) => x.email === SWITCH_OWNER);
  return owner && saved.some((x) => x.id === active.id) ? owner.name : active.name;
}