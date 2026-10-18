import { describe, expect, it } from "vitest";
import { NATIONALITIES, nationalityValue } from "./nationalities";

describe("nationality picker list", () => {
  it("offers the nationalities already saved in the employee records", () => {
    for (const n of ["سعودي", "مصري", "سوري", "أردني", "لبناني", "فلسطيني", "باكستاني", "فلبيني"]) {
      expect(NATIONALITIES.some((x) => x.ar === n)).toBe(true);
    }
  });

  it("keeps every spelling unique and pairs it with an English name", () => {
    const arabic = NATIONALITIES.map((n) => n.ar);
    expect(new Set(arabic).size).toBe(arabic.length);
    expect(NATIONALITIES.every((n) => n.ar.length > 0 && n.en.length > 0)).toBe(true);
  });

  it("saves the Arabic spelling whichever language the name was picked in", () => {
    expect(nationalityValue("Egyptian")).toBe("مصري");
    expect(nationalityValue("  سوري  ")).toBe("سوري");
    expect(nationalityValue("غير مذكور")).toBe("غير مذكور"); // unknown text is kept, never dropped
  });
});
