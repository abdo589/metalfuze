import { describe, expect, it } from "vitest";
import { assessLogin } from "./login-risk";

const win = "Mozilla/5.0 (Windows NT 10.0) Chrome/120";
const ios = "Mozilla/5.0 (iPhone) Version/17 Safari/604";

describe("assessLogin", () => {
  it("first login is not suspicious", () => expect(assessLogin([], { country: "SA", device: win }).suspicious).toBe(false));
  it("known country and device is fine", () => expect(assessLogin([{ country: "SA", device: win }], { country: "SA", device: win }).suspicious).toBe(false));
  it("new country is suspicious", () => expect(assessLogin([{ country: "SA", device: win }], { country: "EG", device: win })).toEqual({ suspicious: true, reason: "دولة جديدة" }));
  it("new device is suspicious", () => expect(assessLogin([{ country: "SA", device: win }], { country: "SA", device: ios })).toEqual({ suspicious: true, reason: "جهاز جديد" }));
});
