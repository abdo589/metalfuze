import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { uniqByName } from "./exec-snapshot";
import type { Project } from "./projects";

const p = (id: string, name: string, allowSameName?: boolean) => ({ id, name, allowSameName }) as Project;

describe("uniqByName", () => {
  it("drops a stale repeated copy of a project name", () => {
    expect(uniqByName([p("a", "برج"), p("b", "برج ")]).map((x) => x.id)).toEqual(["a"]);
  });
  it("keeps a same-name project the user confirmed saving", () => {
    expect(uniqByName([p("a", "برج"), p("b", "برج", true)]).map((x) => x.id)).toEqual(["a", "b"]);
  });
});
