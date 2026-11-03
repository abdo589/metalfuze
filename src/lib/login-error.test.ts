import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "./login-error";
describe("login failure classification", () => {
  it("keeps invalid credentials distinct from network/service/rate failures", () => {
    const invalid = loginErrorMessage({ code: "invalid_credentials", status: 400 });
    expect(loginErrorMessage({ name: "AuthRetryableFetchError" })).not.toBe(invalid);
    expect(loginErrorMessage({ status: 503 })).not.toBe(invalid);
    expect(loginErrorMessage({ status: 429 })).not.toBe(invalid);
  });
});