import { describe, expect, it } from "vitest";
import { accountGreeting, SWITCH_OWNER } from "./account-display";

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
