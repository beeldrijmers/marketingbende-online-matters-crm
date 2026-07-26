import { cn } from "./utils";

describe("cn and the theme's own type scale", () => {
  it("keeps a custom size next to a colour", () => {
    // The whole point: tailwind-merge treated text-meta as a colour and dropped
    // it, so a size set in the code never reached the screen.
    expect(cn("text-meta", "text-ink-3")).toBe("text-meta text-ink-3");
    expect(cn("num text-meta", "text-late")).toBe("num text-meta text-late");
  });

  it("still lets a later size win over an earlier one", () => {
    expect(cn("text-meta", "text-section")).toBe("text-section");
    expect(cn("text-sm", "text-body")).toBe("text-body");
  });

  it("leaves the standard scale working as before", () => {
    expect(cn("text-sm", "text-ink-3")).toBe("text-sm text-ink-3");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });
});
