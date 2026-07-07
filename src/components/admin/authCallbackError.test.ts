import { getAuthCallbackError } from "./authCallbackError";

describe("getAuthCallbackError", () => {
  it("returns null when there is no error parameter", () => {
    expect(getAuthCallbackError("")).toBeNull();
    expect(
      getAuthCallbackError("?access_token=abc&refresh_token=def&type=invite"),
    ).toBeNull();
  });

  it("extracts Supabase error parameters from an expired link", () => {
    const search =
      "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

    expect(getAuthCallbackError(search)).toEqual({
      error: "access_denied",
      errorCode: "otp_expired",
      errorDescription: "Email link is invalid or has expired",
    });
  });

  it("works when the leading question mark is omitted", () => {
    expect(getAuthCallbackError("error=access_denied")).toEqual({
      error: "access_denied",
      errorCode: null,
      errorDescription: null,
    });
  });

  it("ignores an empty error value", () => {
    expect(getAuthCallbackError("?error=&type=recovery")).toBeNull();
  });
});
