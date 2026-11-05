import { describe, expect, it, test } from "vitest";
import { accountGreeting, SWITCH_OWNER, isPinnedAccount, switchAccounts } from "./account-display";

describe("Eilaf account display", () => {
  const owner = { id: "eilaf", email: SWITCH_OWNER, name: "Eilaf" };
  const haitham = { id: "haitham", email: "haitham@metalfuze.local", name: "Haitham" };
  it("keeps Eilaf's name when switching to her saved Haitham account", () => {
    expect(accountGreeting(haitham, [owner, haitham])).toBe("Eilaf");
  });
  it("does not reuse Eilaf's name for unrelated accounts", () => {
    expect(accountGreeting(haitham, [owner])).toBe("Haitham");
  });
});
import { canSwitch } from "./account-display";
test("Hisham and CEO accounts can switch between each other", () => {
  expect(canSwitch("hisham@metalfuze.local")).toBe(true);
  expect(canSwitch("ceo@metalfuze.local")).toBe(true);
  expect(canSwitch("aisha@metalfuze.local")).toBe(false);
});

describe("Eilaf fixed switch accounts", () => {
  const owner = { id: "eilaf", email: SWITCH_OWNER, name: "Eilaf", refresh: "owner-session" };
  it("always includes Haitham and CEO without creating authenticated sessions", () => {
    expect(switchAccounts([owner]).slice(1)).toEqual([
      { id: "haitham@metalfuze.local", email: "haitham@metalfuze.local", name: "هيثم", refresh: "" },
      { id: "ceo@metalfuze.local", email: "ceo@metalfuze.local", name: "CEO", refresh: "" },
    ]);
  });
  it("pins both entries only in Eilaf's saved account group", () => {
    expect(isPinnedAccount("haitham@metalfuze.local", [owner])).toBe(true);
    expect(isPinnedAccount("ceo@metalfuze.local", [owner])).toBe(true);
    expect(isPinnedAccount("aisha@metalfuze.local", [owner])).toBe(false);
    expect(switchAccounts([])).toEqual([]);
    expect(isPinnedAccount("haitham@metalfuze.local", [])).toBe(false);
  });
  it("keeps saved sessions without duplicates and retains expired entries", () => {
    const ceo = { id: "ceo", email: "ceo@metalfuze.local", name: "CEO", refresh: "saved-session" };
    expect(switchAccounts([owner, ceo]).filter((a) => a.email === ceo.email)).toEqual([ceo]);
    expect(switchAccounts([owner, { ...ceo, refresh: "" }]).find((a) => a.email === ceo.email)?.refresh).toBe("");
  });
});
