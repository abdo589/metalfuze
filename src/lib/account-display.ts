export const SWITCH_OWNER = "eilaf@metalfuze.local";
type Identity = { id: string; email?: string | null; name: string };

/** Display only: never use saved identities to determine permissions. */
export function accountGreeting(active: Identity, saved: Identity[]): string {
  const owner = saved.find((x) => x.email === SWITCH_OWNER);
  return owner && saved.some((x) => x.id === active.id) ? owner.name : active.name;
}