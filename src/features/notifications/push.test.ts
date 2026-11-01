import { describe, expect, it } from "vitest";
import { base64UrlToBytes, describeAgent } from "./push";

describe("base64UrlToBytes", () => {
  it("decodes unpadded base64url", () => {
    expect([...base64UrlToBytes("-_8")]).toEqual([0xfb, 0xff]);
    expect([...base64UrlToBytes("AQID")]).toEqual([1, 2, 3]);
  });

  it("decodes a 65-byte VAPID public key", () => {
    expect(base64UrlToBytes("BNbxGYNMhEIi9zrneh7mqV4EUanjLUK3m-mYZBc62frMKrEoMk88r3Lk596T0ck9xlT-mWHVbdkB_3zPxTzBO0E")).toHaveLength(65);
  });
});

describe("describeAgent", () => {
  it("names common browsers and systems", () => {
    expect(describeAgent("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")).toEqual({ browser: "Chrome", os: "Android" });
    expect(describeAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1")).toEqual({ browser: "Safari", os: "iOS" });
    expect(describeAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0")).toEqual({ browser: "Edge", os: "Windows" });
  });

  it("gives up on unknown or missing agents", () => {
    expect(describeAgent(null)).toBeNull();
    expect(describeAgent("curl/8.0")).toBeNull();
  });
});
