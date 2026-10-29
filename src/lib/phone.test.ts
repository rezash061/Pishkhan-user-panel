import { describe, expect, it } from "vitest";
import { groupMobile, normalizeIranMobile } from "./phone";

describe("normalizeIranMobile", () => {
  it.each([
    ["09120001234", "09120001234"],
    ["9120001234", "09120001234"],
    ["+989120001234", "09120001234"],
    ["00989120001234", "09120001234"],
    ["۰۹۱۲۰۰۰۱۲۳۴", "09120001234"],
    ["٠٩١٢٠٠٠١٢٣٤", "09120001234"],
    ["0912 000 1234", "09120001234"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeIranMobile(input)).toBe(expected);
  });

  it.each(["", "0212345678", "0912000123", "091200012345", "08120001234"])("rejects %s", (input) => {
    expect(normalizeIranMobile(input)).toBeNull();
  });

  it("groups for display", () => {
    expect(groupMobile("09120001234")).toBe("0912 000 1234");
  });
});
