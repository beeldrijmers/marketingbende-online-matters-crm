import { describe, expect, it } from "vitest";

import {
  isValidStatusToken,
  STATUS_TOKEN_ALPHABET,
  STATUS_TOKEN_LENGTH,
} from "./token";

const valid = STATUS_TOKEN_ALPHABET.slice(0, 1).repeat(STATUS_TOKEN_LENGTH);

describe("isValidStatusToken", () => {
  it("accepts a token of the exact shape the frontend generates", () => {
    expect(isValidStatusToken(valid)).toBe(true);
  });

  it("rejects anything of the wrong length", () => {
    expect(isValidStatusToken(valid.slice(0, -1))).toBe(false);
    expect(isValidStatusToken(`${valid}a`)).toBe(false);
    expect(isValidStatusToken("")).toBe(false);
  });

  it("rejects characters outside the alphabet, including probes", () => {
    expect(isValidStatusToken("A".repeat(STATUS_TOKEN_LENGTH))).toBe(false);
    expect(isValidStatusToken("0".repeat(STATUS_TOKEN_LENGTH))).toBe(false);
    expect(
      isValidStatusToken("' or 1=1 --".padEnd(STATUS_TOKEN_LENGTH, "a")),
    ).toBe(false);
    expect(isValidStatusToken(`${valid.slice(0, -1)}%`)).toBe(false);
  });

  it("leaves out the characters that get misread when a link is retyped", () => {
    expect(STATUS_TOKEN_ALPHABET).not.toMatch(/[oil01]/);
  });
});
