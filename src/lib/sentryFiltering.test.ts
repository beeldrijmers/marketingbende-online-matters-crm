import { isExpectedAbortError } from "./sentryFiltering";

describe("isExpectedAbortError", () => {
  it("filters a cancelled fetch DOMException", () => {
    expect(
      isExpectedAbortError(
        new DOMException("The operation was aborted", "AbortError"),
      ),
    ).toBe(true);
  });

  it("filters an Error explicitly named AbortError", () => {
    const error = new Error("The operation was aborted");
    error.name = "AbortError";

    expect(isExpectedAbortError(error)).toBe(true);
  });

  it("keeps other runtime errors", () => {
    expect(isExpectedAbortError(new Error("Network request failed"))).toBe(
      false,
    );
  });

  it("does not trust error-like strings or plain objects", () => {
    expect(isExpectedAbortError("AbortError")).toBe(false);
    expect(isExpectedAbortError({ name: "AbortError" })).toBe(false);
  });
});
