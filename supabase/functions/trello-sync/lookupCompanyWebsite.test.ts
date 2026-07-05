// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { lookupCompanyWebsite } from "./lookupCompanyWebsite";

const mockFetch = (
  suggestions: { name: string; domain: string; logo: string }[] | null,
  ok = true,
) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok,
        json: () => Promise.resolve(suggestions ?? []),
      } as Response),
    ),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const suggestion = (domain: string) => ({ name: domain, domain, logo: "" });

describe("lookupCompanyWebsite", () => {
  it("returns the domain whose label exactly matches the normalized name", () => {
    mockFetch([suggestion("coolblue.nl")]);
    return expect(lookupCompanyWebsite("Coolblue")).resolves.toBe(
      "https://coolblue.nl",
    );
  });

  it("skips near-but-not-exact labels and takes the exact one", async () => {
    mockFetch([
      suggestion("onlinemattersllc.com"),
      suggestion("onlinematters.com"),
    ]);
    await expect(lookupCompanyWebsite("Online Matters")).resolves.toBe(
      "https://onlinematters.com",
    );
  });

  it("ignores generic legal tokens when matching", async () => {
    mockFetch([suggestion("acme.nl")]);
    await expect(lookupCompanyWebsite("Acme BV")).resolves.toBe(
      "https://acme.nl",
    );
  });

  it("returns null when no label matches (avoids a wrong logo)", async () => {
    mockFetch([suggestion("some-other-company.com")]);
    await expect(lookupCompanyWebsite("Meenes Marketing")).resolves.toBeNull();
  });

  it("returns null on an empty result", async () => {
    mockFetch([]);
    await expect(lookupCompanyWebsite("Unknown")).resolves.toBeNull();
  });

  it("returns null on a non-ok response", async () => {
    mockFetch(null, false);
    await expect(lookupCompanyWebsite("Coolblue")).resolves.toBeNull();
  });
});
