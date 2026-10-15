import { describe, expect, it } from "vitest";
import { validateEmail, validatePassword } from "../lib/auth/validation";

describe("authentication input validation", () => {
  it("accepts a normal email and rejects malformed input", () => {
    expect(validateEmail("person@example.com")).toBeUndefined();
    expect(validateEmail("not-an-email")).toBe("Enter a valid email address.");
    expect(validateEmail("")).toBe("Email is required.");
  });

  it("enforces the application's eight-character password floor", () => {
    expect(validatePassword("12345678")).toBeUndefined();
    expect(validatePassword("short")).toBe("Password must be at least 8 characters.");
    expect(validatePassword("")).toBe("Password is required.");
  });
});
