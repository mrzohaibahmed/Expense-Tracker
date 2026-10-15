import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config } from "../proxy";

describe("authentication proxy matcher", () => {
  it("runs for application routes", () => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/dashboard" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/login" })).toBe(true);
  });

  it("skips framework and static asset requests", () => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/_next/static/chunk.js" })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/receipt.png" })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/favicon.ico" })).toBe(false);
  });
});
